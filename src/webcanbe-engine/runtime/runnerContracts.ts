import type { ResourceBudget } from "./runnerScheduler"
export class RunnerCleanupError extends Error {}
export const LOCAL_RESOURCE_BUDGET: ResourceBudget = Object.freeze({ memoryMiB: 1536, cpuPercent: 150, tasks: 192, artifactBytes: 32 * 1024 * 1024 })
