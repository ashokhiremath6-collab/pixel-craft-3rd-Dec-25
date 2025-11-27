/**
 * Dependency Validator Module
 * 
 * Provides bulletproof validation for task dependencies to ensure:
 * 1. No self-references (task depending on itself)
 * 2. No forward references (task depending on a later task by numeric ID)
 * 3. No circular references (A→B→C→A)
 * 4. All referenced tasks exist
 * 
 * Validation happens BEFORE saving - if ANY dependency is invalid,
 * the entire import is rejected to maintain data integrity.
 */

export interface ParsedDependency {
  fromTaskId: string;       // The predecessor task's spreadsheet ID (e.g., "2")
  toTaskId: string;         // The successor task's spreadsheet ID (e.g., "3")
  dependencyType: 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish';
  lag: number;
  rawPredecessor: string;   // Original string for error reporting
}

export interface ValidationError {
  taskId: string;
  taskName: string;
  predecessor: string;
  reason: 'self_reference' | 'forward_reference' | 'circular_reference' | 'missing_predecessor' | 'invalid_format' | 'invalid_type';
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  validDependencies: ParsedDependency[];
  summary: {
    totalDependencies: number;
    validCount: number;
    errorCount: number;
    errorTypes: Record<string, number>;
  };
}

const DEPENDENCY_TYPE_MAP: Record<string, 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish'> = {
  'FS': 'finish_to_start',
  'SS': 'start_to_start',
  'FF': 'finish_to_finish',
  'SF': 'start_to_finish',
};

/**
 * Parse a single predecessor string like "2(FS)+3" or "2FS-1"
 */
function parsePredecessorString(pred: string): { taskId: string; type: string; lag: number } | null {
  // Match formats: "2(FS)+0", "2FS+0", "2(FS)", "2FS", "2.1(FS)+2.5"
  const match = pred.match(/^([\w.-]+)\(?([A-Z]{2})\)?([+-]?\d+(?:\.\d+)?)?$/) 
             || pred.match(/^([\w.-]+)([A-Z]{2})([+-]?\d+(?:\.\d+)?)?$/);
  
  if (!match) return null;
  
  const [, taskId, type, lagStr] = match;
  return {
    taskId: taskId.trim(),
    type: type.toUpperCase(),
    lag: lagStr ? parseFloat(lagStr) : 0
  };
}

/**
 * Check if a task ID is numeric (for forward reference detection)
 */
function isNumericTaskId(taskId: string): boolean {
  return /^\d+$/.test(taskId);
}

/**
 * Detect circular dependencies using Depth-First Search
 * Returns the cycle path if found, null otherwise
 */
function detectCycle(
  dependencies: ParsedDependency[],
  taskIds: Set<string>
): { hasCycle: boolean; cyclePath: string[] | null } {
  // Build adjacency list (fromTaskId -> toTaskIds[])
  const graph = new Map<string, string[]>();
  
  for (const dep of dependencies) {
    if (!graph.has(dep.fromTaskId)) {
      graph.set(dep.fromTaskId, []);
    }
    graph.get(dep.fromTaskId)!.push(dep.toTaskId);
  }
  
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  
  function dfs(taskId: string, path: string[]): string[] | null {
    visited.add(taskId);
    recursionStack.add(taskId);
    path.push(taskId);
    
    const successors = graph.get(taskId) || [];
    for (const successor of successors) {
      if (!taskIds.has(successor)) continue;
      
      if (recursionStack.has(successor)) {
        // Cycle detected - return the cycle path
        const cycleStart = path.indexOf(successor);
        return [...path.slice(cycleStart), successor];
      }
      
      if (!visited.has(successor)) {
        const result = dfs(successor, path);
        if (result) return result;
      }
    }
    
    recursionStack.delete(taskId);
    path.pop();
    return null;
  }
  
  // Run DFS from each unvisited node
  const taskIdArray = Array.from(taskIds);
  for (let i = 0; i < taskIdArray.length; i++) {
    const taskId = taskIdArray[i];
    if (!visited.has(taskId)) {
      const cyclePath = dfs(taskId, []);
      if (cyclePath) {
        return { hasCycle: true, cyclePath };
      }
    }
  }
  
  return { hasCycle: false, cyclePath: null };
}

/**
 * Main validation function
 * 
 * @param tasksData - Array of { taskId, taskName, predecessorStr } from import
 * @returns ValidationResult with all errors and valid dependencies
 */
export function validateDependencies(
  tasksData: Array<{ taskId: string; taskName: string; predecessorStr: string }>
): ValidationResult {
  const errors: ValidationError[] = [];
  const validDependencies: ParsedDependency[] = [];
  const taskIdSet = new Set(tasksData.map(t => t.taskId));
  const taskNameMap = new Map(tasksData.map(t => [t.taskId, t.taskName]));
  
  // Phase 1: Parse and validate individual dependencies
  for (const task of tasksData) {
    if (!task.predecessorStr || !task.predecessorStr.trim()) continue;
    
    const predecessors = task.predecessorStr.split(/[,;]/).map(p => p.trim()).filter(Boolean);
    
    for (const pred of predecessors) {
      const parsed = parsePredecessorString(pred);
      
      // Check for invalid format
      if (!parsed) {
        errors.push({
          taskId: task.taskId,
          taskName: task.taskName,
          predecessor: pred,
          reason: 'invalid_format',
          message: `Invalid format "${pred}". Expected: TaskID(FS|SS|FF|SF)[+/-lag]`
        });
        continue;
      }
      
      // Check for invalid dependency type
      const normalizedType = DEPENDENCY_TYPE_MAP[parsed.type];
      if (!normalizedType) {
        errors.push({
          taskId: task.taskId,
          taskName: task.taskName,
          predecessor: pred,
          reason: 'invalid_type',
          message: `Invalid dependency type "${parsed.type}". Must be FS, SS, FF, or SF`
        });
        continue;
      }
      
      // Check for self-reference
      if (parsed.taskId === task.taskId) {
        errors.push({
          taskId: task.taskId,
          taskName: task.taskName,
          predecessor: pred,
          reason: 'self_reference',
          message: `Task cannot depend on itself`
        });
        continue;
      }
      
      // Check if predecessor exists
      if (!taskIdSet.has(parsed.taskId)) {
        errors.push({
          taskId: task.taskId,
          taskName: task.taskName,
          predecessor: pred,
          reason: 'missing_predecessor',
          message: `Predecessor task "${parsed.taskId}" does not exist`
        });
        continue;
      }
      
      // Check for forward reference (only for numeric IDs)
      if (isNumericTaskId(task.taskId) && isNumericTaskId(parsed.taskId)) {
        const currentNum = parseInt(task.taskId);
        const predNum = parseInt(parsed.taskId);
        if (predNum > currentNum) {
          errors.push({
            taskId: task.taskId,
            taskName: task.taskName,
            predecessor: pred,
            reason: 'forward_reference',
            message: `Task ${task.taskId} cannot depend on Task ${parsed.taskId} (forward reference)`
          });
          continue;
        }
      }
      
      // Dependency passed individual validation
      validDependencies.push({
        fromTaskId: parsed.taskId,
        toTaskId: task.taskId,
        dependencyType: normalizedType,
        lag: parsed.lag,
        rawPredecessor: pred
      });
    }
  }
  
  // Phase 2: Check for circular dependencies using graph analysis
  if (validDependencies.length > 0) {
    const { hasCycle, cyclePath } = detectCycle(validDependencies, taskIdSet);
    
    if (hasCycle && cyclePath) {
      // Find the first task in the cycle to report the error
      const cycleTaskId = cyclePath[0];
      const cycleTaskName = taskNameMap.get(cycleTaskId) || cycleTaskId;
      
      // Create human-readable cycle description
      const cycleDescription = cyclePath
        .map(id => taskNameMap.get(id) || id)
        .join(' → ');
      
      errors.push({
        taskId: cycleTaskId,
        taskName: cycleTaskName,
        predecessor: cyclePath.join(' → '),
        reason: 'circular_reference',
        message: `Circular dependency detected: ${cycleDescription}`
      });
      
      // Remove all dependencies involved in the cycle
      const cycleSet = new Set(cyclePath);
      const filteredDeps = validDependencies.filter(
        dep => !cycleSet.has(dep.fromTaskId) || !cycleSet.has(dep.toTaskId)
      );
      validDependencies.length = 0;
      validDependencies.push(...filteredDeps);
    }
  }
  
  // Build summary
  const errorTypes: Record<string, number> = {};
  for (const error of errors) {
    errorTypes[error.reason] = (errorTypes[error.reason] || 0) + 1;
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    validDependencies,
    summary: {
      totalDependencies: validDependencies.length + errors.length,
      validCount: validDependencies.length,
      errorCount: errors.length,
      errorTypes
    }
  };
}

/**
 * Validate a single dependency addition (for manual UI edits)
 * Checks if adding this dependency would create a cycle
 */
export function validateSingleDependency(
  fromTaskId: string,
  toTaskId: string,
  existingDependencies: Array<{ fromTaskId: string; toTaskId: string }>,
  allTaskIds: string[]
): { isValid: boolean; error?: string } {
  // Check self-reference
  if (fromTaskId === toTaskId) {
    return { isValid: false, error: 'A task cannot depend on itself' };
  }
  
  // Check if adding this creates a cycle
  const allDeps: ParsedDependency[] = [
    ...existingDependencies.map(d => ({
      fromTaskId: d.fromTaskId,
      toTaskId: d.toTaskId,
      dependencyType: 'finish_to_start' as const,
      lag: 0,
      rawPredecessor: ''
    })),
    {
      fromTaskId,
      toTaskId,
      dependencyType: 'finish_to_start',
      lag: 0,
      rawPredecessor: ''
    }
  ];
  
  const { hasCycle, cyclePath } = detectCycle(allDeps, new Set(allTaskIds));
  
  if (hasCycle) {
    return { 
      isValid: false, 
      error: `This would create a circular dependency: ${cyclePath?.join(' → ')}`
    };
  }
  
  return { isValid: true };
}

/**
 * Format validation errors for user display
 */
export function formatValidationErrors(result: ValidationResult): string {
  if (result.isValid) return '';
  
  const lines: string[] = [
    `❌ Dependency Validation Failed`,
    ``,
    `Found ${result.summary.errorCount} error(s):`,
  ];
  
  // Group errors by type
  const byType: Record<string, ValidationError[]> = {};
  for (const error of result.errors) {
    if (!byType[error.reason]) byType[error.reason] = [];
    byType[error.reason].push(error);
  }
  
  const reasonLabels: Record<string, string> = {
    self_reference: 'Self-References',
    forward_reference: 'Forward References',
    circular_reference: 'Circular References',
    missing_predecessor: 'Missing Predecessors',
    invalid_format: 'Invalid Format',
    invalid_type: 'Invalid Type'
  };
  
  for (const [reason, errors] of Object.entries(byType)) {
    lines.push(``);
    lines.push(`## ${reasonLabels[reason] || reason} (${errors.length}):`);
    for (const err of errors.slice(0, 10)) { // Limit to 10 per type
      lines.push(`  • Task ${err.taskId} "${err.taskName}": ${err.message}`);
    }
    if (errors.length > 10) {
      lines.push(`  ... and ${errors.length - 10} more`);
    }
  }
  
  return lines.join('\n');
}
