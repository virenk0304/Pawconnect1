import React from "react";
import { aiCommunityPosts } from "../data/aiCommunityPosts";

export default function Community() {
  const posts = aiCommunityPosts;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-2">Community</h1>

      <p className="text-sm text-gray-500 mb-4">
        This community feed is <strong>AI-curated</strong> to ensure safe and verified pet-care
        information.
      </p>

      {/* Disabled Post Box */}
      <div className="mb-6">
        <textarea
          disabled
          className="w-full border rounded p-2 bg-gray-100"
          placeholder="Community posting is restricted in this demo."
        />
        <button
          disabled
          className="mt-2 px-4 py-2 bg-gray-300 text-white rounded cursor-not-allowed"
        >
          Post
        </button>
      </div>

      {/* Community Feed */}
      <div className="space-y-4">
        {posts.map(post => (
          <div
            key={post.post_id}
            className="border rounded p-3 shadow-sm bg-white"
          >
            <div className="flex justify-between items-center mb-1">
              <span className="font-semibold">{post.username}</span>
              <span className="text-xs text-gray-400">
                {new Date(post.created_at).toLocaleDateString()}
              </span>
            </div>

            <p className="text-gray-800 mb-2">{post.post_text}</p>

            <div className="text-sm text-gray-500 flex gap-4">
              <span>👍 {post.like_count}</span>
              <span>💬 {post.comment_count}</span>
              <span className="italic">AI-generated</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
