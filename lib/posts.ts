import { supabase } from "@/lib/supabaseClient";
import { sendNotification } from "@/lib/notifications";

export type Post = {
  id: string;
  author_id: string;
  post_type: "text" | "image" | "video" | "link" | "poll";
  content: string | null;
  link_url: string | null;
  visibility: "public" | "followers" | "friends" | "private" | "unlisted" | "community";
  created_at: string;
};

export type PollOption = {
  id: string;
  option_text: string;
  position: number;
  vote_count: number;
};

export type Poll = {
  multiple_choice: boolean;
  closes_at: string | null;
  options: PollOption[];
  user_voted: string[]; // option IDs the user voted for
  total_votes: number;
};

export type PostWithExtras = Post & {
  media?: Array<{ id: string; file_url: string; file_type: string | null; position: number }>;
  like_count?: number;
  liked_by_me?: boolean;
  bookmarked_by_me?: boolean;
  comment_count?: number;
  repost_count?: number;
  reposted_by_me?: boolean;
  author?: { id: string; username: string; avatar_url: string | null } | null;
  poll?: Poll;
};

export type Comment = {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  // Internal name we use in the app; maps to `parent_id` column in DB
  parent_comment_id?: string | null;
  author?: { id: string; username: string; avatar_url: string | null } | null;
  replies?: Comment[];
};

export async function createPost(params: { authorId: string; content: string; mediaUrls?: string[]; postType?: Post["post_type"]; visibility?: Post["visibility"]; linkUrl?: string | null; communityId?: string; }) {
  const { authorId, content, mediaUrls = [], postType = "text", visibility, linkUrl = null, communityId } = params;
  const vis: Post["visibility"] = visibility ? visibility : (communityId ? "community" : "public");
  const { data: post, error } = await supabase
    .from("posts")
    .insert({ author_id: authorId, content, post_type: postType, visibility: vis, link_url: linkUrl, community_id: communityId ?? null })
    .select("id")
    .single();
  if (error) throw error;
  if (mediaUrls.length > 0) {
    const rows = mediaUrls.map((url, i) => ({ post_id: post.id, file_url: url, position: i }));
    const { error: mErr } = await supabase.from("post_media").insert(rows);
    if (mErr) throw mErr;
  }
  return post.id as string;
}

export async function listRepliesByAuthor(authorId: string, limit = 20, currentUserId?: string | null): Promise<PostWithExtras[]> {
  const { data: posts, error } = await supabase
    .from("posts")
    .select("id, author_id, post_type, content, link_url, visibility, created_at")
    .eq("author_id", authorId)
    .not("reply_to", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  if (!posts || posts.length === 0) return [];

  const ids = posts.map(p => p.id);
  const authorIds = Array.from(new Set(posts.map(p => p.author_id)));

  const queries: unknown[] = [
    supabase.from("post_media").select("id, post_id, file_url, file_type, position").in("post_id", ids),
    supabase.from("post_reactions").select("post_id").eq("reaction", "like").in("post_id", ids),
    supabase.from("users").select("id, username, avatar_url").in("id", authorIds),
    supabase.from("comments").select("post_id").in("post_id", ids),
  ];
  if (currentUserId) {
    queries.push(
      supabase.from("post_reactions").select("post_id").eq("reaction", "like").eq("user_id", currentUserId).in("post_id", ids),
      supabase.from("post_bookmarks").select("post_id").eq("user_id", currentUserId).in("post_id", ids)
    );
  }

  const [mediaRes, likesRes, authorsRes, commentsRes, myLikesRes, myBookmarksRes] = await Promise.all(queries) as [
    { data: Array<{ id: string; post_id: string; file_url: string; file_type: string | null; position: number | null }> | null },
    { data: Array<{ post_id: string }> | null },
    { data: Array<{ id: string; username: string; avatar_url: string | null }> | null },
    { data: Array<{ post_id: string }> | null },
    { data: Array<{ post_id: string }> | null } | undefined,
    { data: Array<{ post_id: string }> | null } | undefined
  ];

  const mediaMap = new Map<string, Array<{ id: string; file_url: string; file_type: string | null; position: number }>>();
  if (mediaRes.data) {
    for (const m of mediaRes.data) {
      const arr = mediaMap.get(m.post_id) ?? [];
      arr.push({ id: m.id, file_url: m.file_url, file_type: m.file_type, position: m.position ?? 0 });
      mediaMap.set(m.post_id, arr);
    }
    for (const [, arr] of mediaMap) arr.sort((a, b) => a.position - b.position);
  }
  const likeCount = new Map<string, number>();
  if (likesRes.data) {
    for (const r of likesRes.data) likeCount.set(r.post_id, (likeCount.get(r.post_id) ?? 0) + 1);
  }
  const authorMap = new Map<string, { id: string; username: string; avatar_url: string | null }>();
  if (authorsRes.data) {
    for (const a of authorsRes.data) authorMap.set(a.id, a);
  }
  const commentCount = new Map<string, number>();
  if (commentsRes.data) {
    for (const c of commentsRes.data) commentCount.set(c.post_id, (commentCount.get(c.post_id) ?? 0) + 1);
  }
  const myLikedPosts = new Set<string>();
  if (myLikesRes?.data) {
    for (const r of myLikesRes.data) myLikedPosts.add(r.post_id);
  }
  const myBookmarkedPosts = new Set<string>();
  if (myBookmarksRes?.data) {
    for (const b of myBookmarksRes.data) myBookmarkedPosts.add(b.post_id);
  }

  return posts.map(p => ({
    ...p,
    media: mediaMap.get(p.id) ?? [],
    like_count: likeCount.get(p.id) ?? 0,
    liked_by_me: myLikedPosts.has(p.id),
    bookmarked_by_me: myBookmarkedPosts.has(p.id),
    comment_count: commentCount.get(p.id) ?? 0,
    author: authorMap.get(p.author_id) ?? null,
  }));
}

type CommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  parent_id: string | null;
};

export async function listCommentsForPost(postId: string, limit = 100): Promise<Comment[]> {
  const { data: rows, error } = await supabase
    .from("comments")
    // parent_id in DB -> parent_comment_id in our type
    .select("id, post_id, author_id, content, created_at, parent_id")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  const authorIds = Array.from(new Set(rows.map(r => r.author_id).filter(Boolean)));
  const authorMap = new Map<string, { id: string; username: string; avatar_url: string | null }>();
  if (authorIds.length > 0) {
    const { data: authors } = await supabase
      .from("users")
      .select("id, username, avatar_url")
      .in("id", authorIds as string[]);
    if (authors) {
      for (const a of authors) {
        authorMap.set(a.id, {
          id: a.id,
          username: a.username,
          avatar_url: a.avatar_url ?? null,
        });
      }
    }
  }

  // Build a threaded structure: top-level comments with nested replies
  const byId = new Map<string, Comment>();
  const rootComments: Comment[] = [];

  for (const r of rows as CommentRow[]) {
    const c: Comment = {
      id: r.id,
      post_id: r.post_id,
      author_id: r.author_id,
      content: r.content,
      created_at: r.created_at,
      parent_comment_id: r.parent_id ?? null,
      author: authorMap.get(r.author_id) ?? null,
      replies: [],
    };
    byId.set(c.id, c);
  }

  for (const c of byId.values()) {
    if (c.parent_comment_id && byId.has(c.parent_comment_id)) {
      const parent = byId.get(c.parent_comment_id)!;
      if (!parent.replies) parent.replies = [];
      parent.replies.push(c);
    } else {
      rootComments.push(c);
    }
  }

  return rootComments;
}

export async function addCommentToPost(postId: string, authorId: string, content: string, parentCommentId?: string | null): Promise<Comment> {
  const trimmed = content.trim();
  if (!trimmed) throw new Error("Comment cannot be empty");
  const { data, error } = await supabase
    .from("comments")
    // parent_id is the DB column for replies
    .insert({ post_id: postId, author_id: authorId, content: trimmed, parent_id: parentCommentId ?? null })
    .select("id, post_id, author_id, content, created_at, parent_id")
    .single();
  if (error || !data) throw error ?? new Error("Failed to create comment");

  // Best-effort fetch of author info
  let author: Comment["author"] = null;
  const { data: a } = await supabase
    .from("users")
    .select("id, username, avatar_url")
    .eq("id", authorId)
    .maybeSingle();
  if (a) {
    author = {
      id: a.id,
      username: a.username,
      avatar_url: (a.avatar_url as string | null) ?? null,
    };
  }



  // Send notification to post author
  const { data: post } = await supabase.from("posts").select("author_id").eq("id", postId).single();
  if (post && post.author_id !== authorId) {
    await sendNotification(supabase, {
      user_id: post.author_id,
      type: "comment",
      actor_id: authorId,
      entity_type: "post",
      entity_id: postId,
      message: "commented on your post",
    });
  }

  return {
    id: data.id as string,
    post_id: data.post_id as string,
    author_id: data.author_id as string,
    content: data.content as string,
    created_at: data.created_at as string,
    parent_comment_id: (data as { parent_id: string | null }).parent_id ?? null,
    author,
    replies: [],
  };
}

export async function updateComment(commentId: string, authorId: string, content: string): Promise<void> {
  const trimmed = content.trim();
  if (!trimmed) throw new Error("Comment cannot be empty");
  const { data, error } = await supabase
    .from("comments")
    .update({ content: trimmed })
    .eq("id", commentId)
    .eq("author_id", authorId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Not authorized to edit this comment");
}

export async function deleteComment(commentId: string, authorId: string): Promise<void> {
  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId)
    .eq("author_id", authorId);
  if (error) throw error;
}

export async function listPosts(limit = 20, includeCommunity = false, currentUserId?: string | null): Promise<PostWithExtras[]> {
  let q = supabase
    .from("posts")
    .select("id, author_id, post_type, content, link_url, visibility, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!includeCommunity) {
    q = q.neq("visibility", "community");
  }
  const { data: posts, error } = await q;
  if (error) throw error;
  if (!posts || posts.length === 0) return [];

  const ids = posts.map(p => p.id);
  const authorIds = Array.from(new Set(posts.map(p => p.author_id)));

  // Build parallel queries
  const queries: unknown[] = [
    supabase.from("post_media").select("id, post_id, file_url, file_type, position").in("post_id", ids),
    supabase.from("post_reactions").select("post_id").eq("reaction", "like").in("post_id", ids),
    supabase.from("users").select("id, username, avatar_url").in("id", authorIds),
    supabase.from("comments").select("post_id").in("post_id", ids),
    // Poll queries
    supabase.from("post_polls").select("post_id, multiple_choice, closes_at").in("post_id", ids),
    supabase.from("post_poll_options").select("id, post_id, option_text, position").in("post_id", ids),
  ];
  // Fetch user-specific data only if logged in
  if (currentUserId) {
    queries.push(
      supabase.from("post_reactions").select("post_id").eq("reaction", "like").eq("user_id", currentUserId).in("post_id", ids),
      supabase.from("post_bookmarks").select("post_id").eq("user_id", currentUserId).in("post_id", ids)
    );
  }

  const [mediaRes, likesRes, authorsRes, commentsRes, pollsRes, pollOptionsRes, myLikesRes, myBookmarksRes] = await Promise.all(queries) as [
    { data: Array<{ id: string; post_id: string; file_url: string; file_type: string | null; position: number | null }> | null },
    { data: Array<{ post_id: string }> | null },
    { data: Array<{ id: string; username: string; avatar_url: string | null }> | null },
    { data: Array<{ post_id: string }> | null },
    { data: Array<{ post_id: string; multiple_choice: boolean; closes_at: string | null }> | null },
    { data: Array<{ id: string; post_id: string; option_text: string; position: number }> | null },
    { data: Array<{ post_id: string }> | null } | undefined,
    { data: Array<{ post_id: string }> | null } | undefined
  ];

  // Process polls
  const pollsMap = new Map<string, Poll>();
  if (pollsRes.data && pollOptionsRes.data) {
    const optionsByPost = new Map<string, PollOption[]>();
    const optionIds: string[] = [];

    // Group options by post
    for (const opt of pollOptionsRes.data) {
      const arr = optionsByPost.get(opt.post_id) ?? [];
      arr.push({ id: opt.id, option_text: opt.option_text, position: opt.position, vote_count: 0 });
      optionsByPost.set(opt.post_id, arr);
      optionIds.push(opt.id);
    }

    // Fetch votes for these options
    const { data: allVotes } = await supabase
      .from("post_poll_votes")
      .select("option_id")
      .in("option_id", optionIds);

    // Count votes
    const voteCounts = new Map<string, number>();
    if (allVotes) {
      for (const v of allVotes) {
        voteCounts.set(v.option_id, (voteCounts.get(v.option_id) ?? 0) + 1);
      }
    }

    // Fetch user votes if logged in
    const userVotedMap = new Map<string, string[]>();
    if (currentUserId && optionIds.length > 0) {
      const { data: myVotes } = await supabase
        .from("post_poll_votes")
        .select("option_id")
        .eq("user_id", currentUserId)
        .in("option_id", optionIds);

      if (myVotes) {
        // Need to map option_id back to post_id to structure correctly
        // We can just keep a set of voted option IDs
        const votedOptionIds = new Set(myVotes.map(v => v.option_id));

        for (const [postId, options] of optionsByPost) {
          const voted = options.filter(o => votedOptionIds.has(o.id)).map(o => o.id);
          if (voted.length > 0) userVotedMap.set(postId, voted);
        }
      }
    }

    // Assemble poll objects
    for (const p of pollsRes.data) {
      const options = optionsByPost.get(p.post_id) ?? [];
      options.sort((a, b) => a.position - b.position);

      // Apply vote counts
      let total = 0;
      for (const opt of options) {
        opt.vote_count = voteCounts.get(opt.id) ?? 0;
        total += opt.vote_count;
      }

      pollsMap.set(p.post_id, {
        multiple_choice: p.multiple_choice,
        closes_at: p.closes_at,
        options,
        user_voted: userVotedMap.get(p.post_id) ?? [],
        total_votes: total
      });
    }
  }

  const mediaMap = new Map<string, Array<{ id: string; file_url: string; file_type: string | null; position: number }>>();
  if (mediaRes.data) {
    for (const m of mediaRes.data) {
      const arr = mediaMap.get(m.post_id) ?? [];
      arr.push({ id: m.id, file_url: m.file_url, file_type: m.file_type, position: m.position ?? 0 });
      mediaMap.set(m.post_id, arr);
    }
    for (const [, arr] of mediaMap) arr.sort((a, b) => a.position - b.position);
  }
  const likeCount = new Map<string, number>();
  if (likesRes.data) {
    for (const r of likesRes.data) likeCount.set(r.post_id, (likeCount.get(r.post_id) ?? 0) + 1);
  }
  const authorMap = new Map<string, { id: string; username: string; avatar_url: string | null }>();
  if (authorsRes.data) {
    for (const a of authorsRes.data) authorMap.set(a.id, a);
  }
  const commentCount = new Map<string, number>();
  if (commentsRes.data) {
    for (const c of commentsRes.data) commentCount.set(c.post_id, (commentCount.get(c.post_id) ?? 0) + 1);
  }
  const myLikedPosts = new Set<string>();
  if (myLikesRes?.data) {
    for (const r of myLikesRes.data) myLikedPosts.add(r.post_id);
  }
  const myBookmarkedPosts = new Set<string>();
  if (myBookmarksRes?.data) {
    for (const b of myBookmarksRes.data) myBookmarkedPosts.add(b.post_id);
  }

  return posts.map(p => ({
    ...p,
    media: mediaMap.get(p.id) ?? [],
    like_count: likeCount.get(p.id) ?? 0,
    liked_by_me: myLikedPosts.has(p.id),
    bookmarked_by_me: myBookmarkedPosts.has(p.id),
    comment_count: commentCount.get(p.id) ?? 0,
    author: authorMap.get(p.author_id) ?? null,
    poll: pollsMap.get(p.id),
  }));
}

export async function listPostsByAuthor(authorId: string, limit = 20, currentUserId?: string | null): Promise<PostWithExtras[]> {
  const { data: posts, error } = await supabase
    .from("posts")
    .select("id, author_id, post_type, content, link_url, visibility, created_at")
    .eq("author_id", authorId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  if (!posts || posts.length === 0) return [];

  const ids = posts.map(p => p.id);
  const authorIds = Array.from(new Set(posts.map(p => p.author_id)));

  // Build parallel queries
  const queries: unknown[] = [
    supabase.from("post_media").select("id, post_id, file_url, file_type, position").in("post_id", ids),
    supabase.from("post_reactions").select("post_id").eq("reaction", "like").in("post_id", ids),
    supabase.from("users").select("id, username, avatar_url").in("id", authorIds),
    supabase.from("comments").select("post_id").in("post_id", ids),
    // Poll queries
    supabase.from("post_polls").select("post_id, multiple_choice, closes_at").in("post_id", ids),
    supabase.from("post_poll_options").select("id, post_id, option_text, position").in("post_id", ids),
  ];
  if (currentUserId) {
    queries.push(
      supabase.from("post_reactions").select("post_id").eq("reaction", "like").eq("user_id", currentUserId).in("post_id", ids),
      supabase.from("post_bookmarks").select("post_id").eq("user_id", currentUserId).in("post_id", ids)
    );
  }

  const [mediaRes, likesRes, authorsRes, commentsRes, pollsRes, pollOptionsRes, myLikesRes, myBookmarksRes] = await Promise.all(queries) as [
    { data: Array<{ id: string; post_id: string; file_url: string; file_type: string | null; position: number | null }> | null },
    { data: Array<{ post_id: string }> | null },
    { data: Array<{ id: string; username: string; avatar_url: string | null }> | null },
    { data: Array<{ post_id: string }> | null },
    { data: Array<{ post_id: string; multiple_choice: boolean; closes_at: string | null }> | null },
    { data: Array<{ id: string; post_id: string; option_text: string; position: number }> | null },
    { data: Array<{ post_id: string }> | null } | undefined,
    { data: Array<{ post_id: string }> | null } | undefined
  ];

  // Process polls
  const pollsMap = new Map<string, Poll>();
  if (pollsRes.data && pollOptionsRes.data) {
    const optionsByPost = new Map<string, PollOption[]>();
    const optionIds: string[] = [];

    // Group options by post
    for (const opt of pollOptionsRes.data) {
      const arr = optionsByPost.get(opt.post_id) ?? [];
      arr.push({ id: opt.id, option_text: opt.option_text, position: opt.position, vote_count: 0 });
      optionsByPost.set(opt.post_id, arr);
      optionIds.push(opt.id);
    }

    // Fetch votes for these options
    const { data: allVotes } = await supabase
      .from("post_poll_votes")
      .select("option_id")
      .in("option_id", optionIds);

    // Count votes
    const voteCounts = new Map<string, number>();
    if (allVotes) {
      for (const v of allVotes) {
        voteCounts.set(v.option_id, (voteCounts.get(v.option_id) ?? 0) + 1);
      }
    }

    // Fetch user votes if logged in
    const userVotedMap = new Map<string, string[]>();
    if (currentUserId && optionIds.length > 0) {
      const { data: myVotes } = await supabase
        .from("post_poll_votes")
        .select("option_id")
        .eq("user_id", currentUserId)
        .in("option_id", optionIds);

      if (myVotes) {
        const votedOptionIds = new Set(myVotes.map(v => v.option_id));
        for (const [postId, options] of optionsByPost) {
          const voted = options.filter(o => votedOptionIds.has(o.id)).map(o => o.id);
          if (voted.length > 0) userVotedMap.set(postId, voted);
        }
      }
    }

    // Assemble poll objects
    for (const p of pollsRes.data) {
      const options = optionsByPost.get(p.post_id) ?? [];
      options.sort((a, b) => a.position - b.position);

      // Apply vote counts
      let total = 0;
      for (const opt of options) {
        opt.vote_count = voteCounts.get(opt.id) ?? 0;
        total += opt.vote_count;
      }

      pollsMap.set(p.post_id, {
        multiple_choice: p.multiple_choice,
        closes_at: p.closes_at,
        options,
        user_voted: userVotedMap.get(p.post_id) ?? [],
        total_votes: total
      });
    }
  }

  const mediaMap = new Map<string, Array<{ id: string; file_url: string; file_type: string | null; position: number }>>();
  if (mediaRes.data) {
    for (const m of mediaRes.data) {
      const arr = mediaMap.get(m.post_id) ?? [];
      arr.push({ id: m.id, file_url: m.file_url, file_type: m.file_type, position: m.position ?? 0 });
      mediaMap.set(m.post_id, arr);
    }
    for (const [, arr] of mediaMap) arr.sort((a, b) => a.position - b.position);
  }
  const likeCount = new Map<string, number>();
  if (likesRes.data) {
    for (const r of likesRes.data) likeCount.set(r.post_id, (likeCount.get(r.post_id) ?? 0) + 1);
  }
  const authorMap = new Map<string, { id: string; username: string; avatar_url: string | null }>();
  if (authorsRes.data) {
    for (const a of authorsRes.data) authorMap.set(a.id, a);
  }
  const commentCount = new Map<string, number>();
  if (commentsRes.data) {
    for (const c of commentsRes.data) commentCount.set(c.post_id, (commentCount.get(c.post_id) ?? 0) + 1);
  }
  const myLikedPosts = new Set<string>();
  if (myLikesRes?.data) {
    for (const r of myLikesRes.data) myLikedPosts.add(r.post_id);
  }
  const myBookmarkedPosts = new Set<string>();
  if (myBookmarksRes?.data) {
    for (const b of myBookmarksRes.data) myBookmarkedPosts.add(b.post_id);
  }

  return posts.map(p => ({
    ...p,
    media: mediaMap.get(p.id) ?? [],
    like_count: likeCount.get(p.id) ?? 0,
    liked_by_me: myLikedPosts.has(p.id),
    bookmarked_by_me: myBookmarkedPosts.has(p.id),
    comment_count: commentCount.get(p.id) ?? 0,
    author: authorMap.get(p.author_id) ?? null,
    poll: pollsMap.get(p.id),
  }));
}

export async function listPostsByCommunity(communityId: string, limit = 20, currentUserId?: string | null): Promise<PostWithExtras[]> {
  const { data: posts, error } = await supabase
    .from("posts")
    .select("id, author_id, post_type, content, link_url, visibility, created_at")
    .eq("community_id", communityId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  if (!posts || posts.length === 0) return [];

  const ids = posts.map(p => p.id);
  const authorIds = Array.from(new Set(posts.map(p => p.author_id)));

  // Build parallel queries
  const queries: unknown[] = [
    supabase.from("post_media").select("id, post_id, file_url, file_type, position").in("post_id", ids),
    supabase.from("post_reactions").select("post_id").eq("reaction", "like").in("post_id", ids),
    supabase.from("users").select("id, username, avatar_url").in("id", authorIds),
    supabase.from("comments").select("post_id").in("post_id", ids),
    // Poll queries
    supabase.from("post_polls").select("post_id, multiple_choice, closes_at").in("post_id", ids),
    supabase.from("post_poll_options").select("id, post_id, option_text, position").in("post_id", ids),
  ];
  if (currentUserId) {
    queries.push(
      supabase.from("post_reactions").select("post_id").eq("reaction", "like").eq("user_id", currentUserId).in("post_id", ids),
      supabase.from("post_bookmarks").select("post_id").eq("user_id", currentUserId).in("post_id", ids)
    );
  }

  const [mediaRes, likesRes, authorsRes, commentsRes, pollsRes, pollOptionsRes, myLikesRes, myBookmarksRes] = await Promise.all(queries) as [
    { data: Array<{ id: string; post_id: string; file_url: string; file_type: string | null; position: number | null }> | null },
    { data: Array<{ post_id: string }> | null },
    { data: Array<{ id: string; username: string; avatar_url: string | null }> | null },
    { data: Array<{ post_id: string }> | null },
    { data: Array<{ post_id: string; multiple_choice: boolean; closes_at: string | null }> | null },
    { data: Array<{ id: string; post_id: string; option_text: string; position: number }> | null },
    { data: Array<{ post_id: string }> | null } | undefined,
    { data: Array<{ post_id: string }> | null } | undefined
  ];

  // Process polls
  const pollsMap = new Map<string, Poll>();
  if (pollsRes.data && pollOptionsRes.data) {
    const optionsByPost = new Map<string, PollOption[]>();
    const optionIds: string[] = [];

    // Group options by post
    for (const opt of pollOptionsRes.data) {
      const arr = optionsByPost.get(opt.post_id) ?? [];
      arr.push({ id: opt.id, option_text: opt.option_text, position: opt.position, vote_count: 0 });
      optionsByPost.set(opt.post_id, arr);
      optionIds.push(opt.id);
    }

    // Fetch votes for these options
    const { data: allVotes } = await supabase
      .from("post_poll_votes")
      .select("option_id")
      .in("option_id", optionIds);

    // Count votes
    const voteCounts = new Map<string, number>();
    if (allVotes) {
      for (const v of allVotes) {
        voteCounts.set(v.option_id, (voteCounts.get(v.option_id) ?? 0) + 1);
      }
    }

    // Fetch user votes if logged in
    const userVotedMap = new Map<string, string[]>();
    if (currentUserId && optionIds.length > 0) {
      const { data: myVotes } = await supabase
        .from("post_poll_votes")
        .select("option_id")
        .eq("user_id", currentUserId)
        .in("option_id", optionIds);

      if (myVotes) {
        const votedOptionIds = new Set(myVotes.map(v => v.option_id));
        for (const [postId, options] of optionsByPost) {
          const voted = options.filter(o => votedOptionIds.has(o.id)).map(o => o.id);
          if (voted.length > 0) userVotedMap.set(postId, voted);
        }
      }
    }

    // Assemble poll objects
    for (const p of pollsRes.data) {
      const options = optionsByPost.get(p.post_id) ?? [];
      options.sort((a, b) => a.position - b.position);

      // Apply vote counts
      let total = 0;
      for (const opt of options) {
        opt.vote_count = voteCounts.get(opt.id) ?? 0;
        total += opt.vote_count;
      }

      pollsMap.set(p.post_id, {
        multiple_choice: p.multiple_choice,
        closes_at: p.closes_at,
        options,
        user_voted: userVotedMap.get(p.post_id) ?? [],
        total_votes: total
      });
    }
  }

  const mediaMap = new Map<string, Array<{ id: string; file_url: string; file_type: string | null; position: number }>>();
  if (mediaRes.data) {
    for (const m of mediaRes.data) {
      const arr = mediaMap.get(m.post_id) ?? [];
      arr.push({ id: m.id, file_url: m.file_url, file_type: m.file_type, position: m.position ?? 0 });
      mediaMap.set(m.post_id, arr);
    }
    for (const [, arr] of mediaMap) arr.sort((a, b) => a.position - b.position);
  }
  const likeCount = new Map<string, number>();
  if (likesRes.data) {
    for (const r of likesRes.data) likeCount.set(r.post_id, (likeCount.get(r.post_id) ?? 0) + 1);
  }
  const authorMap = new Map<string, { id: string; username: string; avatar_url: string | null }>();
  if (authorsRes.data) {
    for (const a of authorsRes.data) authorMap.set(a.id, a);
  }
  const commentCount = new Map<string, number>();
  if (commentsRes.data) {
    for (const c of commentsRes.data) commentCount.set(c.post_id, (commentCount.get(c.post_id) ?? 0) + 1);
  }
  const myLikedPosts = new Set<string>();
  if (myLikesRes?.data) {
    for (const r of myLikesRes.data) myLikedPosts.add(r.post_id);
  }
  const myBookmarkedPosts = new Set<string>();
  if (myBookmarksRes?.data) {
    for (const b of myBookmarksRes.data) myBookmarkedPosts.add(b.post_id);
  }

  return posts.map(p => ({
    ...p,
    media: mediaMap.get(p.id) ?? [],
    like_count: likeCount.get(p.id) ?? 0,
    liked_by_me: myLikedPosts.has(p.id),
    bookmarked_by_me: myBookmarkedPosts.has(p.id),
    comment_count: commentCount.get(p.id) ?? 0,
    author: authorMap.get(p.author_id) ?? null,
    poll: pollsMap.get(p.id),
  }));
}

export async function toggleLike(postId: string, userId: string) {
  const { data: existing } = await supabase
    .from("post_reactions")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .eq("reaction", "like")
    .maybeSingle();
  if (existing) {
    const { error } = await supabase.from("post_reactions").delete().eq("id", existing.id);
    if (error) throw error;
    return { liked: false };
  } else {
    const { error } = await supabase.from("post_reactions").insert({ post_id: postId, user_id: userId, reaction: "like" });
    if (error) throw error;

    // Send notification to post author
    const { data: post } = await supabase.from("posts").select("author_id").eq("id", postId).single();
    if (post && post.author_id !== userId) {
      await sendNotification(supabase, {
        user_id: post.author_id,
        type: "like",
        actor_id: userId,
        entity_type: "post",
        entity_id: postId,
        message: "liked your post",
      });
    }

    return { liked: true };
  }
}

export async function listBookmarkedPosts(userId: string, limit = 50): Promise<PostWithExtras[]> {
  const { data: bookmarks, error: bmError } = await supabase
    .from("post_bookmarks")
    .select("post_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (bmError) throw bmError;
  if (!bookmarks || bookmarks.length === 0) return [];

  const ids = bookmarks.map(b => b.post_id as string);
  const { data: posts, error } = await supabase
    .from("posts")
    .select("id, author_id, post_type, content, link_url, visibility, created_at")
    .in("id", ids)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!posts || posts.length === 0) return [];

  const authorIds = Array.from(new Set(posts.map(p => p.author_id)));

  const [mediaRes, likesRes, authorsRes] = await Promise.all([
    supabase.from("post_media").select("id, post_id, file_url, file_type, position").in("post_id", ids),
    supabase.from("post_reactions").select("post_id").eq("reaction", "like").in("post_id", ids),
    supabase.from("users").select("id, username, avatar_url").in("id", authorIds),
  ]);

  const mediaMap = new Map<string, Array<{ id: string; file_url: string; file_type: string | null; position: number }>>();
  if (mediaRes.data) {
    for (const m of mediaRes.data as Array<{ id: string; post_id: string; file_url: string; file_type: string | null; position: number | null }>) {
      const arr = mediaMap.get(m.post_id) ?? [];
      arr.push({ id: m.id, file_url: m.file_url, file_type: m.file_type, position: m.position ?? 0 });
      mediaMap.set(m.post_id, arr);
    }
    for (const [, arr] of mediaMap) arr.sort((a, b) => a.position - b.position);
  }

  const likeCount = new Map<string, number>();
  if (likesRes.data) {
    for (const r of likesRes.data as Array<{ post_id: string }>) likeCount.set(r.post_id, (likeCount.get(r.post_id) ?? 0) + 1);
  }

  const authorMap = new Map<string, { id: string; username: string; avatar_url: string | null }>();
  if (authorsRes.data) {
    for (const a of authorsRes.data as Array<{ id: string; username: string; avatar_url: string | null }>) authorMap.set(a.id, a);
  }

  return posts.map(p => ({
    ...p,
    media: mediaMap.get(p.id) ?? [],
    like_count: likeCount.get(p.id) ?? 0,
    author: authorMap.get(p.author_id) ?? null,
  }));
}

export async function toggleBookmark(postId: string, userId: string) {
  const { data: existing } = await supabase
    .from("post_bookmarks")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) {
    const { error } = await supabase.from("post_bookmarks").delete().eq("id", existing.id);
    if (error) throw error;
    return { bookmarked: false } as const;
  } else {
    const { error } = await supabase.from("post_bookmarks").insert({ post_id: postId, user_id: userId });
    if (error) throw error;
    return { bookmarked: true } as const;
  }
}

export async function toggleRepost(postId: string, userId: string) {
  // Check if user already reposted this post
  const { data: existing } = await supabase
    .from("reposts")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    // Un-repost: delete the repost record
    const { error } = await supabase.from("reposts").delete().eq("id", existing.id);
    if (error) throw error;
    return { reposted: false } as const;
  } else {
    // Repost: create a new repost record
    const { error } = await supabase.from("reposts").insert({ post_id: postId, user_id: userId });
    if (error) throw error;
    return { reposted: true } as const;
  }
}

export async function getRepostCount(postId: string): Promise<number> {
  const { count, error } = await supabase
    .from("reposts")
    .select("id", { count: "exact", head: true })
    .eq("post_id", postId);
  if (error) throw error;
  return count ?? 0;
}

// ============ POLL FUNCTIONS ============

export async function createPollPost(params: {
  authorId: string;
  content: string;
  options: string[];
  multipleChoice?: boolean;
  closesAt?: Date | null;
  communityId?: string;
}): Promise<string> {
  const { authorId, content, options, multipleChoice = false, closesAt = null, communityId } = params;

  if (options.length < 2 || options.length > 6) {
    throw new Error("Poll must have 2-6 options");
  }

  const vis: Post["visibility"] = communityId ? "community" : "public";

  // Create the post
  const { data: post, error: postError } = await supabase
    .from("posts")
    .insert({
      author_id: authorId,
      content,
      post_type: "poll",
      visibility: vis,
      community_id: communityId ?? null
    })
    .select("id")
    .single();
  if (postError) throw postError;

  // Create the poll record
  const { error: pollError } = await supabase
    .from("post_polls")
    .insert({
      post_id: post.id,
      multiple_choice: multipleChoice,
      closes_at: closesAt?.toISOString() ?? null
    });
  if (pollError) throw pollError;

  // Create poll options
  const optionRows = options.map((text, i) => ({
    post_id: post.id,
    option_text: text.trim(),
    position: i,
  }));
  const { error: optionsError } = await supabase
    .from("post_poll_options")
    .insert(optionRows);
  if (optionsError) throw optionsError;

  return post.id as string;
}

export async function votePoll(optionId: string, userId: string): Promise<{ voted: boolean }> {
  // Check if user already voted for this option
  const { data: existing } = await supabase
    .from("post_poll_votes")
    .select("option_id")
    .eq("option_id", optionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    // Unvote: remove the vote
    const { error } = await supabase
      .from("post_poll_votes")
      .delete()
      .eq("option_id", optionId)
      .eq("user_id", userId);
    if (error) throw error;
    return { voted: false };
  } else {
    // Vote: add the vote
    const { error } = await supabase
      .from("post_poll_votes")
      .insert({ option_id: optionId, user_id: userId });
    if (error) throw error;
    return { voted: true };
  }
}

export async function getPollData(postId: string, userId?: string | null): Promise<Poll | null> {
  // Get poll record
  const { data: poll, error: pollError } = await supabase
    .from("post_polls")
    .select("multiple_choice, closes_at")
    .eq("post_id", postId)
    .maybeSingle();

  if (pollError || !poll) return null;

  // Get poll options
  const { data: options, error: optionsError } = await supabase
    .from("post_poll_options")
    .select("id, option_text, position")
    .eq("post_id", postId)
    .order("position", { ascending: true });

  if (optionsError || !options) return null;

  const optionIds = options.map(o => o.id);

  // Get vote counts for each option
  const { data: votes } = await supabase
    .from("post_poll_votes")
    .select("option_id")
    .in("option_id", optionIds);

  const voteCounts = new Map<string, number>();
  let totalVotes = 0;
  if (votes) {
    for (const v of votes) {
      voteCounts.set(v.option_id, (voteCounts.get(v.option_id) ?? 0) + 1);
      totalVotes++;
    }
  }

  // Get user's votes if logged in
  const userVoted: string[] = [];
  if (userId) {
    const { data: userVotes } = await supabase
      .from("post_poll_votes")
      .select("option_id")
      .eq("user_id", userId)
      .in("option_id", optionIds);
    if (userVotes) {
      for (const v of userVotes) {
        userVoted.push(v.option_id);
      }
    }
  }

  return {
    multiple_choice: poll.multiple_choice,
    closes_at: poll.closes_at,
    total_votes: totalVotes,
    user_voted: userVoted,
    options: options.map(o => ({
      id: o.id,
      option_text: o.option_text,
      position: o.position,
      vote_count: voteCounts.get(o.id) ?? 0,
    })),
  };
}

export async function getPost(postId: string): Promise<PostWithExtras | null> {
  const { data: post, error } = await supabase
    .from("posts")
    .select("id, author_id, post_type, content, link_url, visibility, created_at")
    .eq("id", postId)
    .single();

  if (error || !post) return null;

  const [mediaRes, authorRes, pollRes, pollOptionsRes] = await Promise.all([
    supabase.from("post_media").select("*").eq("post_id", postId).order("position"),
    supabase.from("users").select("id, username, avatar_url").eq("id", post.author_id).single(),
    supabase.from("post_polls").select("*").eq("post_id", postId).maybeSingle(),
    supabase.from("post_poll_options").select("*").eq("post_id", postId).order("position"),
  ]);

  let poll: Poll | undefined;
  if (pollRes.data && pollOptionsRes.data) {
    const options = pollOptionsRes.data.map(opt => ({
      id: opt.id,
      option_text: opt.option_text,
      position: opt.position,
      vote_count: 0
    }));
    poll = {
      multiple_choice: pollRes.data.multiple_choice,
      closes_at: pollRes.data.closes_at,
      options,
      user_voted: [],
      total_votes: 0
    };
  }

  return {
    ...post,
    media: mediaRes.data?.map(m => ({
      id: m.id,
      file_url: m.file_url,
      file_type: m.file_type,
      position: m.position
    })) ?? [],
    author: authorRes.data ? {
      id: authorRes.data.id,
      username: authorRes.data.username,
      avatar_url: authorRes.data.avatar_url
    } : null,
    poll
  };
}

