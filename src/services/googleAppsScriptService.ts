
// This file contains functions to interact with the Google Apps Script backend.

// ✅ Deployed Google Apps Script Web App URL
const BASE_URL =
  "https://script.google.com/macros/s/AKfycbza_LK2bB8xthli7ei5WZEofF4d4jJjgV6p8D20DvRt0P7B1EyyMZh6h7n2VodX-x1KmA/exec";

/**
 * Helper function to make POST requests to the Google Apps Script backend.
 * Automatically attaches username from localStorage.
 */
async function makeBackendRequest(action: string, data: any = {}) {
  const username = localStorage.getItem("paw_username");

  if (!username) {
    throw new Error("Username not set. Please configure it in App Settings.");
  }

  const payload = {
    action,
    username,
    ...data
  };

  try {
    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Backend error:", text);
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    console.error("Backend connection failed:", err);
    throw err;
  }
}

/* ======================================================
   COMMUNITY ACTIONS
====================================================== */

export async function createPost(postText: string, type: string) {
  const formattedType = type.replace(/ & /g, "_").toLowerCase();

  return makeBackendRequest("create_post", {
    post_text: postText,
    type: formattedType
  });
}

export async function getPosts(): Promise<any[]> {
  const res = await makeBackendRequest("get_posts");
  return res.posts || [];
}

export async function likePost(postId: string) {
  return makeBackendRequest("like_post", {
    post_id: postId
  });
}

export async function addComment(postId: string, commentText: string) {
  return makeBackendRequest("add_comment", {
    post_id: postId,
    comment_text: commentText
  });
}
