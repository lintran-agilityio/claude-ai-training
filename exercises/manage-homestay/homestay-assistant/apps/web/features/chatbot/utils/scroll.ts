export const getChatScrollContainer = () => {
  const root = document.querySelector("[data-sidebar-chat]");
  if (!root) return null;

  // StickToBottom / Copilot scroll content — walk up to the real overflow scroller.
  const scrollContent = root.querySelector(
    '[data-testid="copilot-scroll-content"]',
  );
  if (scrollContent) {
    let element = scrollContent.parentElement;
    while (element && element !== root) {
      const { overflowY } = getComputedStyle(element);
      if (overflowY === "auto" || overflowY === "scroll") {
        return element;
      }
      element = element.parentElement;
    }
  }

  // Fallback: first overflow container under the chat messages region.
  const region = root.querySelector("[data-chat-messages]");
  if (!region) return null;

  if (region instanceof HTMLElement) {
    const { overflowY } = getComputedStyle(region);
    if (overflowY === "auto" || overflowY === "scroll") {
      return region;
    }
  }

  const nested = region.querySelectorAll("*");
  for (const node of nested) {
    if (!(node instanceof HTMLElement)) continue;
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") {
      return node;
    }
  }

  return region instanceof HTMLElement ? region : null;
};

export const scrollChatToEnd = (behavior: ScrollBehavior = "auto") => {
  const scrollContainer = getChatScrollContainer();
  if (!scrollContainer) return;

  if (behavior === "auto") {
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
    return;
  }

  scrollContainer.scrollTo({
    top: scrollContainer.scrollHeight,
    behavior,
  });
};

/** Scroll after layout paints — needed when messages mount or grow. */
export const scheduleScrollChatToEnd = (
  behavior: ScrollBehavior = "auto",
) => {
  const run = () => scrollChatToEnd(behavior);

  requestAnimationFrame(() => {
    run();
    requestAnimationFrame(run);
  });

  window.setTimeout(run, 0);
  window.setTimeout(run, 50);
  window.setTimeout(run, 200);
};
