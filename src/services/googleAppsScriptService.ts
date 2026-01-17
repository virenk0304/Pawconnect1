// Frontend service to interact with Google Apps Script backend (Community features)

const BASE_URL =
  "https://script.google.com/macros/s/AKfycbza_LK2bB8xthli7ei5WZEofF4d4jJjgV6p8D20DvRt0P7B1EyyMZh6h7n2VodX-x1KmA/exec";

/**
 * Internal helper to talk to Apps Script backend
 */
async function sendRequest(action: string, payload: Record<string, any> = {}) {
  const username = localStorage.getItem("paw_username");

  if (!username) {
    throw new Error("Username not set. Please configure it in App Settings.");
  }

  const body = {
    action,
    username,
    ...payload
  };

  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("Apps Script error:", text);
    throw new Error("Backend request failed");
  }

  return response.json();
}

/* ======================================================
   COMMUNITY POSTS
====================================================== */

export async function createPost(postText: string, type: string) {
  const formattedType = type.replace(/ & /g, "_").toLowerCase();

  return sendRequest("create_post", {
    post_text: postText,
    type: formattedType
  });
}

export async function getPosts() {
  const res = await sendRequest("get_posts");
  return res.posts || [];
}

/* ======================================================
   LIKES
====================================================== */

export async function likePost(postId: string) {
  return sendRequest("like_post", {
    post_id: postId
  });
}

/* ======================================================
   COMMENTS
====================================================== */

export async function addComment(postId: string, commentText: string) {
  return sendRequest("add_comment", {
    post_id: postId,
    comment_text: commentText
  });
}
