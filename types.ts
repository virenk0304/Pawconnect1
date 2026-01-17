
export enum PetType {
  CAT = 'Cat',
  DOG = 'Dog',
  RABBIT = 'Rabbit',
  BIRD = 'Bird',
  FISH = 'Fish',
  OTHER = 'Other'
}

export interface MedicalRecord {
  id: string;
  petId: string;
  fileName: string;
  fileType: 'pdf' | 'image' | 'video';
  fileUrl: string;
  description?: string;
  timestamp: string;
}

export interface Pet {
  id: string;
  name: string;
  breed: string;
  age: number;
  weight: number;
  emergencyContact: string;
  type: PetType;
  imageUrl?: string;
  createdAt: string;
  healthScore?: number;
  records?: MedicalRecord[];
}

export enum PostType {
  UPDATE = 'Update',
  QUESTION = 'Question',
  CARE_TIPS = 'Care & Tips',
  HEALTH = 'Health'
}

export interface Comment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface Post {
  id: string;
  author: string;
  type: PostType;
  content: string;
  likes: number;
  likedByMe?: boolean;
  comments: Comment[];
  createdAt: string;
}

export interface Tip {
  id: string;
  title: string;
  category: 'Health' | 'Training' | 'Nutrition' | 'General';
  content: string;
  icon: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}