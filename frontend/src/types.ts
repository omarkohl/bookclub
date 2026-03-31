export interface Participant {
  id: number;
  name: string;
  created_at?: string;
}

export interface Book {
  id: number;
  title: string;
  authors: string;
  description?: string;
  link?: string;
  nominated_by: number | null;
  status: string;
  created_at?: string;
}

export interface Settings {
  credit_budget: number;
  voting_state: string;
  pins_enabled: boolean;
}

export interface Vote {
  participant_id: number;
  book_id: number;
  credits: number;
}

export interface VoteDetail {
  participant_name: string;
  credits: number;
}

export interface BookScore {
  book_id: number;
  score: number;
  votes: VoteDetail[];
}
