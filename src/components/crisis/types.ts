export type CrisisType = "medical" | "food_water" | "rescue";

export type RequesterInfo = {
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  publicId: string | null;
};

export type CrisisRequest = {
  id: string;
  type: CrisisType;
  description: string;
  lng: number;
  lat: number;
  createdAt: string;
  claimed: boolean;
  claimedBy: string | null;
  createdBy: string | null;
  aiRoutePlan?: string | null;
  taskId?: string | null;
  taskStatus?: string | null;
  requester?: RequesterInfo | null;
  reportedFraud?: boolean;
};
