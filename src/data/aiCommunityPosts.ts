export interface CommunityPost {
  post_id: string;
  username: string;
  post_text: string;
  type: string;
  created_at: string;
  like_count: number;
  comment_count: number;
}

export const aiCommunityPosts: CommunityPost[] = [
  {
    post_id: "ai_1",
    username: "PawConnect AI",
    post_text:
      "🐶 Daily Health Tip: Regular walks help prevent obesity and improve mental health in dogs.",
    type: "health",
    created_at: new Date().toISOString(),
    like_count: 18,
    comment_count: 2
  },
  {
    post_id: "ai_2",
    username: "PawConnect AI",
    post_text:
      "🐾 Community Update: Vaccination reminders are now available inside PawConnect.",
    type: "update",
    created_at: new Date().toISOString(),
    like_count: 25,
    comment_count: 4
  },
  {
    post_id: "ai_3",
    username: "PawConnect AI",
    post_text:
      "🍎 Nutrition Tip: Always provide fresh water and avoid feeding pets processed human food.",
    type: "care_tips",
    created_at: new Date().toISOString(),
    like_count: 14,
    comment_count: 1
  }
];
