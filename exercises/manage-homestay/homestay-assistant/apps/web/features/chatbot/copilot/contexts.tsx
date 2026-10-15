"use client";

import {
  CurrentDateReadable,
  UserReadable,
} from "@/features/chatbot/copilot/readable";

export const CopilotContexts = () => {
  return (
    <>
      <CurrentDateReadable />
      <UserReadable />
    </>
  );
};
