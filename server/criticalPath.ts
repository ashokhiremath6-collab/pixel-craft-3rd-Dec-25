import { Task, TaskDependency } from "../shared/schema";

interface TaskNode {
  task: Task;
  earlyStart: number;
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  totalFloat: number;
  isCritical: boolean;
  dependencies: TaskDependency[];
}

interface CriticalPathResult {
  tasks: TaskNode[];
  criticalPath: string[];
  projectDuration: number;
  criticalPathDuration: number;
}

/**
 * Calculate the critical path for a set of tasks using the Critical Path Method (CPM)
 * Supports all 4 dependency types: FS, SS, FF, SF
 */
export function calculateCriticalPath(
  tasks: Task[],
  dependencies: TaskDependency[]
): CriticalPathResult {
  if (tasks.length === 0) {
    return {
      tasks: [],
      criticalPath: [],
      projectDuration: 0,
      criticalPathDuration: 0
    };
  }

  // Create task map for quick lookup
  const taskMap = new Map<string, Task>();
  tasks.forEach(task => taskMap.set(task.id, task));

  // Group dependencies by task
  const taskDependencies = new Map<string, TaskDependency[]>();
  dependencies.forEach(dep => {
    if (!taskDependencies.has(dep.toTaskId)) {
      taskDependencies.set(dep.toTaskId, []);
    }
    taskDependencies.get(dep.toTaskId)!.push(dep);
  });

  // Calculate duration for each task (in days)
  const getDuration = (task: Task): number => {
    if (task.duration) {
      return parseInt(String(task.duration)) || 0;
    }
    if (task.startDate && task.endDate) {
      const start = new Date(task.startDate);
      const end = new Date(task.endDate);
      return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }
    return 0;
  };

  // Initialize task nodes
  const taskNodes = new Map<string, TaskNode>();
  tasks.forEach(task => {
    taskNodes.set(task.id, {
      task,
      earlyStart: 0,
      earlyFinish: getDuration(task),
      lateStart: 0,
      lateFinish: 0,
      totalFloat: 0,
      isCritical: false,
      dependencies: taskDependencies.get(task.id) || []
    });
  });

  // FORWARD PASS: Calculate Early Start and Early Finish
  const calculateForwardPass = () => {
    // Sort tasks topologically (dependencies first)
    const visited = new Set<string>();
    const sorted: string[] = [];

    const visit = (taskId: string) => {
      if (visited.has(taskId)) return;
      visited.add(taskId);

      const deps = taskDependencies.get(taskId) || [];
      deps.forEach(dep => {
        if (taskMap.has(dep.fromTaskId)) {
          visit(dep.fromTaskId);
        }
      });

      sorted.push(taskId);
    };

    tasks.forEach(task => visit(task.id));

    // Calculate ES and EF for each task
    sorted.forEach(taskId => {
      const node = taskNodes.get(taskId);
      if (!node) return;

      const deps = node.dependencies;
      if (deps.length === 0) {
        // No dependencies, starts at day 0
        node.earlyStart = 0;
        node.earlyFinish = node.earlyStart + getDuration(node.task);
      } else {
        // Calculate based on dependencies
        let maxES = 0;
        let maxEF = 0;

        deps.forEach(dep => {
          const predNode = taskNodes.get(dep.fromTaskId);
          if (!predNode) return;

          const lag = parseFloat(String(dep.lag || 0));

          switch (dep.dependencyType) {
            case 'finish_to_start':
              // FS: Successor starts after predecessor finishes
              maxES = Math.max(maxES, predNode.earlyFinish + lag);
              break;
            case 'start_to_start':
              // SS: Successor starts after predecessor starts
              maxES = Math.max(maxES, predNode.earlyStart + lag);
              break;
            case 'finish_to_finish':
              // FF: Successor finishes after predecessor finishes
              maxEF = Math.max(maxEF, predNode.earlyFinish + lag);
              break;
            case 'start_to_finish':
              // SF: Successor finishes after predecessor starts
              maxEF = Math.max(maxEF, predNode.earlyStart + lag);
              break;
          }
        });

        // Set ES and EF based on dependency constraints
        if (maxES > 0) {
          node.earlyStart = maxES;
          node.earlyFinish = node.earlyStart + getDuration(node.task);
        }

        if (maxEF > 0) {
          node.earlyFinish = Math.max(node.earlyFinish, maxEF);
          // Adjust ES if EF changed
          if (node.earlyFinish > node.earlyStart + getDuration(node.task)) {
            node.earlyStart = node.earlyFinish - getDuration(node.task);
          }
        }
      }
    });
  };

  // BACKWARD PASS: Calculate Late Start and Late Finish
  const calculateBackwardPass = () => {
    // Find project end date (maximum EF)
    let projectEnd = 0;
    taskNodes.forEach(node => {
      projectEnd = Math.max(projectEnd, node.earlyFinish);
    });

    // Initialize all tasks with project end as their late finish
    taskNodes.forEach(node => {
      node.lateFinish = projectEnd;
      node.lateStart = node.lateFinish - getDuration(node.task);
    });

    // Create reverse dependency map (successors for each task)
    const successors = new Map<string, TaskDependency[]>();
    dependencies.forEach(dep => {
      if (!successors.has(dep.fromTaskId)) {
        successors.set(dep.fromTaskId, []);
      }
      successors.get(dep.fromTaskId)!.push(dep);
    });

    // Sort tasks in reverse topological order
    const visited = new Set<string>();
    const sorted: string[] = [];

    const visit = (taskId: string) => {
      if (visited.has(taskId)) return;
      visited.add(taskId);

      const succs = successors.get(taskId) || [];
      succs.forEach(dep => {
        if (taskMap.has(dep.toTaskId)) {
          visit(dep.toTaskId);
        }
      });

      sorted.push(taskId);
    };

    tasks.forEach(task => visit(task.id));

    // Calculate LS and LF for each task
    sorted.forEach(taskId => {
      const node = taskNodes.get(taskId);
      if (!node) return;

      const succs = successors.get(taskId) || [];
      if (succs.length === 0) {
        // No successors, LF is project end
        node.lateFinish = projectEnd;
        node.lateStart = node.lateFinish - getDuration(node.task);
      } else {
        let minLF = projectEnd;
        let minLS = projectEnd;

        succs.forEach(dep => {
          const succNode = taskNodes.get(dep.toTaskId);
          if (!succNode) return;

          const lag = parseFloat(String(dep.lag || 0));

          switch (dep.dependencyType) {
            case 'finish_to_start':
              // FS: Predecessor must finish before successor starts
              minLF = Math.min(minLF, succNode.lateStart - lag);
              break;
            case 'start_to_start':
              // SS: Predecessor must start before successor starts
              minLS = Math.min(minLS, succNode.lateStart - lag);
              break;
            case 'finish_to_finish':
              // FF: Predecessor must finish before successor finishes
              minLF = Math.min(minLF, succNode.lateFinish - lag);
              break;
            case 'start_to_finish':
              // SF: Predecessor must start before successor finishes
              minLS = Math.min(minLS, succNode.lateFinish - lag);
              break;
          }
        });

        if (minLF < projectEnd) {
          node.lateFinish = minLF;
          node.lateStart = node.lateFinish - getDuration(node.task);
        }

        if (minLS < projectEnd) {
          node.lateStart = Math.min(node.lateStart, minLS);
          node.lateFinish = node.lateStart + getDuration(node.task);
        }
      }
    });
  };

  // Calculate float and identify critical tasks
  const calculateFloat = () => {
    taskNodes.forEach(node => {
      node.totalFloat = node.lateStart - node.earlyStart;
      node.isCritical = Math.abs(node.totalFloat) < 0.01; // Account for floating point precision
    });
  };

  // Find the critical path
  const findCriticalPath = (): string[] => {
    const criticalTasks = Array.from(taskNodes.values())
      .filter(node => node.isCritical)
      .map(node => node.task.id);

    // Sort critical tasks by early start to get the path in order
    const sortedCritical = criticalTasks
      .map(id => taskNodes.get(id)!)
      .sort((a, b) => a.earlyStart - b.earlyStart)
      .map(node => node.task.id);

    return sortedCritical;
  };

  // Execute CPM algorithm
  calculateForwardPass();
  calculateBackwardPass();
  calculateFloat();

  const criticalPath = findCriticalPath();
  const projectDuration = Math.max(...Array.from(taskNodes.values()).map(n => n.earlyFinish));
  const criticalPathDuration = projectDuration;

  return {
    tasks: Array.from(taskNodes.values()),
    criticalPath,
    projectDuration,
    criticalPathDuration
  };
}
