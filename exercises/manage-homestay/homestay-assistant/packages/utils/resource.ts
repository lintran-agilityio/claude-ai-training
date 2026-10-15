export const getAgentResourceId = (userId: string, agentId: string) =>
  `${userId}:${agentId}`;

export const parseAgentResourceId = (resourceId: string) => {
  const separatorIndex = resourceId.indexOf(":");

  if (separatorIndex === -1) {
    return { userId: resourceId, agentId: "" };
  }

  return {
    userId: resourceId.slice(0, separatorIndex),
    agentId: resourceId.slice(separatorIndex + 1),
  };
};
