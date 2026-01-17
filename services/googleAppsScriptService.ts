
// This file contains functions to interact with the Google Apps Script backend.

// The URL of the deployed Google Apps Script Web App.
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbza_LK2bB8xthli7ei5WZEofF4d4jJjgV6p8D20DvRt0P7B1EyyMZh6h7n2VodX-x1KmA/exec";

/**
 * Helper function to make POST requests to the Google Apps Script backend.
 * All requests are POST and send a JSON payload.
 * It automatically includes the 'username' from local storage for authentication/identification.
 *
 * @param action The specific action for the backend to perform (e.g., 'create_post').
 * @param data The additional payload specific to the action.
 * @returns A Promise that resolves with the JSON response from the backend.
 * @throws An error if the username is not found or if the backend request fails.
 */
async function makeBackendRequest(action: string, data: any = {}): Promise<any> {
  const username = localStorage.getItem("paw_username"); // Retrieve username from local storage
  if (!username) {
    // If username is not set, throw an error. User must configure it in settings.
    throw new Error("User not signed in. Please set your username in app settings.");
  }

  const payload = {
    action: action,
    username: username, // Include username in every request for backend identification
    ...data,
  };

  try {
    const response = await fetch(WEB_APP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      // If the HTTP response status is not 2xx, throw an error.
      const errorText = await response.text();
      console.error(`Backend error for action '${action}': ${response.status} - ${errorText}`);
      throw new Error(`Backend request failed (HTTP ${response.status}): ${errorText}`);
    }

    // Attempt to parse the JSON response.
    // Some backend actions might not return a body or a JSON body.
    try {
      return await response.json();
    } catch (e) {
      // If response is not JSON, return a success indicator or raw text.
      return { success: true, message: `Action '${action}' completed successfully.` };
    }
  } catch (error) {
    console.error(`Network or parsing error for action '${action}':`, error);
    throw new Error(`Failed to connect to backend: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Creates a new community post on the backend.
 *
 * @param postText The main content of the post.
 * @param type The category of the post (e.g., 'Update', 'Question').
 * @returns A Promise that resolves with the backend's response for the creation.
 */
export async function createPost(postText: string, type: string) {
  // Convert frontend PostType (e.g., "Care & Tips") to backend's expected format (e.g., "care_tips")
  const formattedType = type.replace(/ & /g, '_').toLowerCase();
  return makeBackendRequest("create_post", {
    post_text: postText,
    type: formattedType,
  });
}

/**
 * Fetches all community posts from the backend.
 *
 * @returns A Promise that resolves with an array of post objects.
 *          Assumes the backend returns an array under a 'posts' key,
 *          where each post object generally matches the frontend's `Post` interface.
 */
export async function getPosts(): Promise<any[]> {
  const response = await makeBackendRequest("get_posts", {});
  // The backend is expected to return an object like { posts: [...] }
  return response.posts || [];
}

/**
 * Likes or unlikes a specific community post on the backend.
 * The backend is responsible for toggling the like status.
 *
 * @param postId The unique ID of the post to like/unlike.
 * @returns A Promise that resolves with the backend's response for the like action.
 */
export async function likePost(postId: string) {
  return makeBackendRequest("like_post", {
    post_id: postId,
  });
}

/**
 * Adds a new comment to a specified community post on the backend.
 *
 * @param postId The unique ID of the post to add a comment to.
 * @param commentText The content of the comment.
 * @returns A Promise that resolves with the backend's response for the comment action.
 */
export async function addComment(postId: string, commentText: string) {
  return makeBackendRequest("add_comment", {
    post_id: postId,
    comment_text: commentText,
  });
}
