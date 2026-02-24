export type Note = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  updated_at: string;
  is_pinned?: boolean;
  isNew?: boolean;
};
