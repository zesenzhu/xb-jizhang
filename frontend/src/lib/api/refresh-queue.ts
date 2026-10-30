export interface RefreshQueue {
  run(operation: () => Promise<void>): Promise<void>;
}

export function createRefreshQueue(): RefreshQueue {
  let activeRefresh: Promise<void> | null = null;

  return {
    run(operation): Promise<void> {
      if (activeRefresh === null) {
        activeRefresh = operation().finally(() => {
          activeRefresh = null;
        });
      }
      return activeRefresh;
    },
  };
}
