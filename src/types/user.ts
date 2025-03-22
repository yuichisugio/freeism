export type User = {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  createdAt: string; // ISO日付文字列
};

export type UserProfile = {
  bio?: string;
  location?: string;
  website?: string;
  phoneNumber?: string;
  soldCount?: number;
  boughtCount?: number;
  rating?: number;
} & User;

export type UserAuth = {
  userId: string;
  email: string;
  username: string;
  avatarUrl?: string;
};
