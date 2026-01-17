import React, { useEffect, useState } from "react";

interface CommunityPost {
  post_id: string;
  username: string;
  post_text: string;
  created_at: string;
  like_count: number;
  comment_count: number;
}

export default function Community() {
  const [postText, setPostText] = useState("");
  const [posts, setPosts] = useState<CommunityPost[]>([]);

  // Load posts from localStorage on first load
  useEffect(() => {
    const savedPosts = localStorage.getItem("paw_posts");
    if (savedPosts) {
      setPosts(JSON.parse(savedPosts));
    }
  }, []);

  // Save posts to localStorage
  const persistPosts = (updatedPosts: CommunityPost[]) => {
    setPosts(updatedPosts);
    localStorage.setItem("paw_posts", JSON.stringify(updatedPosts));
  };

  // Create a new post
  const handlePost = () => {
    if (!postText.trim()) return;

    const username =
      localStorage.getItem("paw_username") || "guest_user";

    const newPost: CommunityPost = {
      post_id: "p_" + Date.now(),
      username: username,
      post_text: postText,
      created_at: new Date().toISOString(),
      like_count: 0,
      comment_count: 0
    };

    persistPosts([newPost, ...posts]);
    setPostText("");
  };

  // Like a post
  const handleLike = (postId: string) => {
    const updatedPosts = posts.map(post =>
      post.post_id === postId
        ? { ...post, like_count: post.like_count + 1 }
        : post
    );

    persistPosts(updatedPosts);
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-2">Community</h1>

      <p className="text-sm text-gray-500 mb-4">
        Community posts are stored locally for instant interaction in this demo.
      </p>

      {/* Create Post */}
      <div className="mb-6">
        <textarea
          className="w-full border rounded p-2"
          placeholder="Share something about your pet..."
          value={postText}
          onChange={(e) => setPostText(e.target.value)}
        />
        <button
          onClick={handlePost}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded"
        >
          Post
        </button>
      </div>

      {/* Community Feed */}
      <div className="space-y-4">
        {posts.length === 0 && (
          <p className="text-sm text-gray-400">
            No posts yet. Be the first to post!
          </p>
        )}

        {posts.map((post) => (
          <div
            key={post.post_id}
            className="border rounded p-3 bg-white shadow-sm"
          >
            <div className="flex justify-between items-center mb-1">
              <span className="font-semibold">{post.username}</span>
              <span className="text-xs text-gray-400">
                {new Date(post.created_at).toLocaleString()}
              </span>
            </div>

            <p className="mb-2">{post.post_text}</p>

            <button
              onClick={() => handleLike(post.post_id)}
              className="text-sm text-blue-600"
            >
              👍 Like ({post.like_count})
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

