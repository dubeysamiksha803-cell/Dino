import { SupabaseClient } from "@supabase/supabase-js";

export type NotificationType =
    | "like"
    | "comment"
    | "follow"
    | "mention"
    | "friend_request"
    | "message"
    | "system";

export type Notification = {
    id: string;
    user_id: string;
    type: NotificationType;
    actor_id: string | null;
    entity_type: string | null;
    entity_id: string | null;
    message: string;
    read: boolean;
    created_at: string;
    // Joined actor data
    actor?: {
        id: string;
        username: string;
        avatar_url: string | null;
    } | null;
};

/**
 * Fetch notifications for a user with actor details
 */
export async function fetchNotifications(
    supabase: SupabaseClient,
    userId: string,
    options?: { limit?: number; unreadOnly?: boolean }
): Promise<{ data: Notification[] | null; error: Error | null }> {
    try {
        let query = supabase
            .from("notifications")
            .select(`
        id,
        user_id,
        type,
        actor_id,
        entity_type,
        entity_id,
        message,
        read,
        created_at,
        actor:users!notifications_actor_id_fkey(id, username, avatar_url)
      `)
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

        if (options?.unreadOnly) {
            query = query.eq("read", false);
        }

        if (options?.limit) {
            query = query.limit(options.limit);
        }

        const { data, error } = await query;

        if (error) throw error;

        return { data: data as unknown as Notification[], error: null };
    } catch (err) {
        console.error("Error fetching notifications:", err);
        return { data: null, error: err as Error };
    }
}

/**
 * Mark a single notification as read
 */
export async function markNotificationAsRead(
    supabase: SupabaseClient,
    notificationId: string
): Promise<{ success: boolean; error: Error | null }> {
    try {
        const { error } = await supabase
            .from("notifications")
            .update({ read: true })
            .eq("id", notificationId);

        if (error) throw error;

        return { success: true, error: null };
    } catch (err) {
        console.error("Error marking notification as read:", err);
        return { success: false, error: err as Error };
    }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(
    supabase: SupabaseClient,
    userId: string
): Promise<{ success: boolean; error: Error | null }> {
    try {
        const { error } = await supabase
            .from("notifications")
            .update({ read: true })
            .eq("user_id", userId)
            .eq("read", false);

        if (error) throw error;

        return { success: true, error: null };
    } catch (err) {
        console.error("Error marking all notifications as read:", err);
        return { success: false, error: err as Error };
    }
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(
    supabase: SupabaseClient,
    userId: string
): Promise<{ count: number; error: Error | null }> {
    try {
        const { count, error } = await supabase
            .from("notifications")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("read", false);

        if (error) throw error;

        return { count: count ?? 0, error: null };
    } catch (err) {
        console.error("Error getting unread count:", err);
        return { count: 0, error: err as Error };
    }
}

/**
 * Subscribe to real-time notification updates
 */
export function subscribeToNotifications(
    supabase: SupabaseClient,
    userId: string,
    onInsert: (notification: Notification) => void,
    onUpdate?: (notification: Notification) => void
) {
    const channel = supabase
        .channel(`notifications:${userId}`)
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "notifications",
                filter: `user_id=eq.${userId}`,
            },
            async (payload) => {
                // Fetch the full notification with actor data
                const { data } = await supabase
                    .from("notifications")
                    .select(`
            id, user_id, type, actor_id, entity_type, entity_id, message, read, created_at,
            actor:users!notifications_actor_id_fkey(id, username, avatar_url)
          `)
                    .eq("id", payload.new.id)
                    .single();

                if (data) {
                    onInsert(data as unknown as Notification);
                }
            }
        )
        .on(
            "postgres_changes",
            {
                event: "UPDATE",
                schema: "public",
                table: "notifications",
                filter: `user_id=eq.${userId}`,
            },
            (payload) => {
                if (onUpdate) {
                    onUpdate(payload.new as Notification);
                }
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
}

/**
 * Create a notification (client-side helper - prefer Edge Function for server-side)
 */
export async function createNotification(
    supabase: SupabaseClient,
    notification: {
        user_id: string;
        type: NotificationType;
        actor_id?: string;
        entity_type?: string;
        entity_id?: string;
        message: string;
    }
): Promise<{ data: Notification | null; error: Error | null }> {
    try {
        const { data, error } = await supabase
            .from("notifications")
            .insert({
                user_id: notification.user_id,
                type: notification.type,
                actor_id: notification.actor_id || null,
                entity_type: notification.entity_type || null,
                entity_id: notification.entity_id || null,
                message: notification.message,
                read: false,
            })
            .select()
            .single();

        if (error) throw error;

        return { data: data as Notification, error: null };
    } catch (err) {
        console.error("Error creating notification:", err);
        return { data: null, error: err as Error };
    }
}

/**
 * Delete a notification
 */
export async function deleteNotification(
    supabase: SupabaseClient,
    notificationId: string
): Promise<{ success: boolean; error: Error | null }> {
    try {
        const { error } = await supabase
            .from("notifications")
            .delete()
            .eq("id", notificationId);

        if (error) throw error;

        return { success: true, error: null };
    } catch (err) {
        console.error("Error deleting notification:", err);
        return { success: false, error: err as Error };
    }
}
/**
 * Send a notification via Edge Function
 */
export async function sendNotification(
    supabase: SupabaseClient,
    notification: {
        user_id: string; // The recipient
        type: NotificationType;
        actor_id?: string; // The person doing the action (current user)
        entity_type?: string;
        entity_id?: string;
        message: string;
    }
): Promise<{ success: boolean; error: Error | null }> {
    try {
        const { error } = await supabase.functions.invoke("send-notification", {
            body: notification,
        });

        if (error) throw error;

        return { success: true, error: null };
    } catch (err) {
        console.error("Error sending notification:", err);
        return { success: false, error: err as Error };
    }
}
