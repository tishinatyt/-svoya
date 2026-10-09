export type Kind = "event" | "circle" | "beauty" | "business" | "help";
export type Entry = {
  id: string;
  owner_id: string | null;
  kind: Kind;
  title: string;
  description: string;
  city: string;
  category: string;
  location: string;
  starts_at: string | null;
  capacity: number;
  price: number;
  is_demo: boolean;
  status: string;
  created_at: string;
  format?: "standard" | "coffee" | "quick";
  ends_at?: string | null;
  expires_at?: string | null;
  district?: string;
  image_paths?: string[];
  recurrence_note?: string;
  welcome_newcomers?: boolean;
  shelter_info?: string;
  accessibility_info?: string;
  children_welcome?: boolean;
};
export type Profile = {
  id: string;
  name: string;
  city: string;
  bio: string;
  interests: string[];
  photo_paths: string[];
  membership_status?: "pending" | "approved" | "suspended";
  discoverable?: boolean;
  district?: string;
  availability?: string[];
  welcomes_newcomers?: boolean;
  member_title?: "svoya" | "active" | "inspirer" | "ambassador";
  member_title_updated_at?: string | null;
};
export type Membership = {
  entry_id: string;
  user_id: string;
  status: "pending" | "joined" | "rejected" | "waitlisted";
  needs_greeter?: boolean;
  greeter_id?: string | null;
  created_at: string;
};
export type ClubRequest = {
  id: string;
  entry_id: string;
  user_id: string;
  message: string;
  contact: string;
  status: string;
  created_at: string;
};
export type Message = {
  id: string;
  entry_id: string;
  user_id: string;
  body: string;
  created_at: string;
};
export const labels: Record<Kind, string> = {
  event: "Події",
  circle: "Свої кола",
  beauty: "Б’юті",
  business: "Бізнес",
  help: "Допомога",
};
export const categories: Record<Kind, string[]> = {
  event: ["Кава та розмови", "Творчість", "Прогулянки", "Спорт", "Розвиток"],
  circle: ["Книги", "Підприємництво", "Моє місто", "Творчість", "Спорт"],
  beauty: ["Волосся", "Нігті", "Брови та вії", "Макіяж", "Догляд", "Стиль"],
  business: ["Послуги", "Співпраця", "Вакансії", "Наставництво"],
  help: ["Потрібна допомога", "Можу допомогти", "Рекомендації", "Волонтерство"],
};
