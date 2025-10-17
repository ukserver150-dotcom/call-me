import { type Timestamp } from "firebase/firestore";

export interface User {
  uid: string;
  fullname: string;
  username: string;
  createdAt: Timestamp;
  avatarUrl: string | null;
}

export interface FriendRequest {
  from: string;
  username: string;
  fullname: string;
  ts: Timestamp;
}

export interface Friend {
    uid: string;
    username: string;
    fullname: string;
    since: Timestamp;
}

export interface Message {
  id: string;
  from: string;
  type: 'text' | 'image' | 'video' | 'gif';
  text: string; // for text messages, or as a caption
  mediaUrl?: string; // for image, video, gif
  createdAt: Timestamp;
}
