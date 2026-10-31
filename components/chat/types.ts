export type User = {
  id: string;
  username: string;
  avatarUrl?: string | null;
  isOnline?: boolean;
};

export type Chat = {
  id: string;
  title: string;
  type: "direct" | "group";
  avatarUrl?: string | null;
  lastMessageAt?: string;
  unread?: number;
  members?: User[];
};

export type Message = {
  id: string;
  chatId: string;
  sender: User;
  content: string;
  createdAt: string;
  edited?: boolean;
  replyToId?: string;
  type?: "text" | "gif" | "image" | "video" | "audio" | "file" | "system";
  status?: "sent" | "delivered" | "read"; // For read receipts
  // derived for UI
  replyPreview?: { id: string; author: string; content: string } | null;
  reactions?: Record<string, number>;
  myReactions?: string[];
};
