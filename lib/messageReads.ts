import { supabase } from "@/lib/supabaseClient";

/**
 * Mark messages as read by inserting into message_reads table.
 * This is called when a user opens a chat to mark all messages from others as read.
 */
export async function markMessagesAsRead(
    chatId: string,
    userId: string
): Promise<void> {
    try {
        // Get all unread messages in this chat that are NOT from the current user
        const { data: messages, error: fetchError } = await supabase
            .from("messages")
            .select("id, sender_id")
            .eq("chat_id", chatId)
            .neq("sender_id", userId);

        if (fetchError) {
            console.error("Error fetching messages for read marking:", fetchError);
            return;
        }

        if (!messages || messages.length === 0) return;

        // Check which messages are already marked as read
        const messageIds = messages.map((m) => m.id);
        const { data: existingReads } = await supabase
            .from("message_reads")
            .select("message_id")
            .in("message_id", messageIds)
            .eq("user_id", userId);

        const alreadyRead = new Set((existingReads ?? []).map((r) => r.message_id));
        const toMark = messageIds.filter((id) => !alreadyRead.has(id));

        if (toMark.length === 0) return;

        // Insert read receipts
        const inserts = toMark.map((messageId) => ({
            message_id: messageId,
            user_id: userId,
        }));

        const { error: insertError } = await supabase
            .from("message_reads")
            .insert(inserts);

        if (insertError) {
            console.error("Error inserting read receipts:", insertError);
        }
    } catch (err) {
        console.error("Error marking messages as read:", err);
    }
}

/**
 * Get the read status for messages sent by the current user.
 * Returns a map of messageId -> "delivered" | "read"
 */
export async function getMessageReadStatus(
    messageIds: string[],
    senderId: string
): Promise<Map<string, "delivered" | "read">> {
    const statusMap = new Map<string, "delivered" | "read">();

    if (messageIds.length === 0) return statusMap;

    try {
        // Check if any recipient has read these messages
        const { data: reads, error } = await supabase
            .from("message_reads")
            .select("message_id, user_id")
            .in("message_id", messageIds)
            .neq("user_id", senderId); // Exclude the sender's own reads

        if (error) {
            console.error("Error fetching read status:", error);
            // Default all to delivered
            messageIds.forEach((id) => statusMap.set(id, "delivered"));
            return statusMap;
        }

        // Group reads by message_id
        const readByMessage = new Set((reads ?? []).map((r) => r.message_id));

        messageIds.forEach((id) => {
            statusMap.set(id, readByMessage.has(id) ? "read" : "delivered");
        });

        return statusMap;
    } catch (err) {
        console.error("Error getting message read status:", err);
        messageIds.forEach((id) => statusMap.set(id, "delivered"));
        return statusMap;
    }
}
