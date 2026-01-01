/**
 * Core Metrics Analysis Engine
 *
 * Implements the main BFS traversal algorithm from the Ruby aac-metrics tool.
 * Calculates effort scores for all buttons in an AAC board set.
 *
 * Based on: aac-metrics/lib/aac-metrics/metrics.rb
 */

import {
  AACTree,
  AACPage,
  AACButton,
  AACSemanticCategory,
  AACScanType,
} from "../../../core/treeStructure";
import { CellScanningOrder } from "../../../types/aac";
import { ButtonMetrics, MetricsResult } from "./types";
import {
  baseBoardEffort,
  distanceEffort,
  visualScanEffort,
  EFFORT_CONSTANTS,
  localScanEffort,
  scanningEffort,
} from "./effort";

interface ToVisitItem {
  board: AACPage;
  level: number;
  entryX: number;
  entryY: number;
  priorEffort?: number;
  temporaryHomeId?: string | null;
  entryCloneId?: string;
  entrySemanticId?: string;
}

export class MetricsCalculator {
  private locale: string = "en";

  /**
   * Main analysis function - calculates metrics for an AAC tree
   *
   * @param tree - The AAC tree to analyze
   * @returns Complete metrics result
   */
  analyze(tree: AACTree): MetricsResult {
    // Get root board - prioritize tree.rootId, then fall back to boards with no parentId
    let rootBoard: AACPage | undefined;
    if (tree.rootId) {
      rootBoard = tree.pages[tree.rootId];
    }
    if (!rootBoard) {
      rootBoard = Object.values(tree.pages).find((p: AACPage) => !p.parentId);
    }
    if (!rootBoard) {
      throw new Error("No root board found in tree");
    }

    this.locale = (rootBoard as any).locale || "en";

    // Step 1: Build semantic/clone reference maps
    const { setRefs, setPcts } = this.buildReferenceMaps(tree);

    // Step 2: BFS traversal from root board
    const startBoards: AACPage[] = [rootBoard];

    // Find boards with temporary_home settings
    Object.values(tree.pages).forEach((board: AACPage) => {
      board.buttons.forEach((btn: AACButton) => {
        if (btn.targetPageId && btn.semanticAction) {
          // Check for temporary_home in platformData or fallback
          const tempHome =
            btn.semanticAction.platformData?.grid3?.parameters
              ?.temporary_home || btn.semanticAction.fallback?.temporary_home;
          if (tempHome === "prior") {
            startBoards.push(board);
          } else if (tempHome === true && btn.targetPageId) {
            const targetBoard = tree.getPage(btn.targetPageId);
            if (targetBoard && !startBoards.includes(targetBoard)) {
              startBoards.push(targetBoard);
            }
          }
        }
      });
    });

    const knownButtons = new Map<string, ButtonMetrics>();
    const levels: { [level: number]: ButtonMetrics[] } = {};
    let totalButtons = 0;

    // Analyze from each starting board
    startBoards.forEach((startBoard) => {
      const result = this.analyzeFrom(
        tree,
        startBoard,
        setPcts,
        startBoard === rootBoard,
      );

      result.buttons.forEach((btn) => {
        const existing = knownButtons.get(btn.label);
        if (!existing || btn.effort < existing.effort) {
          knownButtons.set(btn.label, btn);
        }
        if (btn.count && existing && existing.count) {
          btn.count += existing.count;
        }
      });

      if (startBoard === rootBoard) {
        Object.assign(levels, result.levels);
        totalButtons = result.totalButtons;
      }
    });

    // Convert to array and sort
    const buttons = Array.from(knownButtons.values()).sort(
      (a, b) => a.effort - b.effort,
    );

    // Calculate grid dimensions
    const grid = this.calculateGridDimensions(tree);

    return {
      analysis_version: "0.2",
      locale: this.locale,
      total_boards: Object.keys(tree.pages).length,
      total_buttons: totalButtons,
      total_words: buttons.length,
      reference_counts: setRefs,
      grid,
      buttons,
      levels,
    };
  }

  /**
   * Build reference maps for semantic_id and clone_id frequencies
   */
  private buildReferenceMaps(tree: AACTree): {
    setRefs: { [id: string]: number };
    setPcts: { [id: string]: number };
  } {
    const setRefs: { [id: string]: number } = {};
    const cellRefs: { [ref: string]: number } = {};
    let rootRows = 0;
    let rootCols = 0;
    // First pass: calculate dimensions and count references
    Object.values(tree.pages).forEach((board: AACPage) => {
      rootRows = rootRows || board.grid.length;
      rootCols = rootCols || board.grid[0]?.length || 0;

      // Count semantic_id and clone_id occurrences from board properties (upstream)
      board.semantic_ids?.forEach((id: string) => {
        setRefs[id] = (setRefs[id] || 0) + 1;
      });
      board.clone_ids?.forEach((id: string) => {
        setRefs[id] = (setRefs[id] || 0) + 1;
      });

      // Count cell references
      for (let r = 0; r < board.grid.length; r++) {
        for (let c = 0; c < (board.grid[r]?.length || 0); c++) {
          const ref = `${r}.${c}`;
          const hasButton = board.grid[r][c] !== null;
          cellRefs[ref] = (cellRefs[ref] || 0) + (hasButton ? 1.0 : 0.25);
        }
      }
    });

    // Calculate percentages
    const setPcts: { [id: string]: number } = {};
    const totalBoards = Object.keys(tree.pages).length;

    Object.entries(setRefs).forEach(([id, count]) => {
      // Extract location from ID (Ruby uses id.split(/-/)[1])
      const parts = id.split("-");
      if (parts.length >= 2) {
        const loc = parts[1];
        const cellCount = cellRefs[loc] || totalBoards;
        setPcts[id] = count / cellCount;
        if (setPcts[id] > 1.0) {
          // console.log(`⚠️ setPcts[${id}] = ${setPcts[id].toFixed(4)} (count=${count}, cellCount=${cellCount.toFixed(2)})`);
          setPcts[id] = 1.0; // Cap at 1.0 like Ruby effectively does
        }
      } else {
        setPcts[id] = count / totalBoards;
      }
    });

    return { setRefs, setPcts };
  }

  /**
   * Count scan items for visual scanning effort
   * When block scanning is enabled, count unique scan blocks instead of individual buttons
   */
  private countScanItems(
    board: AACPage,
    currentRowIndex: number,
    currentColIndex: number,
    priorScanBlocks: Set<number>,
    blockScanEnabled: boolean,
  ): number {
    if (!blockScanEnabled) {
      // Linear scanning: count all buttons before current position
      let count = 0;
      for (let r = 0; r <= currentRowIndex; r++) {
        const row = board.grid[r];
        if (!row) continue;
        for (let c = 0; c < row.length; c++) {
          if (r === currentRowIndex && c === currentColIndex) return count;
          const btn = row[c];
          if (btn && (btn.label || btn.id).length > 0) {
            count++;
          }
        }
      }
      return count;
    }

    // Block scanning: count unique scan blocks before current position
    const seenBlocks = new Set<number>();
    for (let r = 0; r <= currentRowIndex; r++) {
      const row = board.grid[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        if (r === currentRowIndex && c === currentColIndex)
          return seenBlocks.size;
        const btn = row[c];
        if (btn && (btn.label || btn.id).length > 0) {
          const block =
            btn.scanBlock ||
            (btn.scanBlocks && btn.scanBlocks.length > 0
              ? btn.scanBlocks[0]
              : null);
          if (block !== null) seenBlocks.add(block);
        }
      }
    }
    return seenBlocks.size;
  }

  /**
   * Analyze starting from a specific board
   */
  private analyzeFrom(
    tree: AACTree,
    brd: AACPage,
    setPcts: { [id: string]: number },
    _isRoot: boolean,
  ): {
    buttons: ButtonMetrics[];
    levels: { [level: number]: ButtonMetrics[] };
    totalButtons: number;
  } {
    const visitedBoardIds = new Map<string, number>();
    const toVisit: ToVisitItem[] = [
      {
        board: brd,
        level: 0,
        entryX: 1.0,
        entryY: 1.0,
      },
    ];

    const knownButtons = new Map<string, ButtonMetrics>();
    const levels: { [level: number]: ButtonMetrics[] } = {};

    while (toVisit.length > 0) {
      const item = toVisit.shift();
      if (!item) break;
      const {
        board,
        level,
        entryX,
        entryY,
        priorEffort = 0,
        temporaryHomeId,
      } = item;

      // Skip if already visited at a lower level with equal or better prior effort
      // Skip if already visited at a strictly lower level
      const existingLevel = visitedBoardIds.get(board.id);
      if (existingLevel !== undefined && existingLevel < level) {
        continue;
      }
      visitedBoardIds.set(board.id, level);

      const rows = board.grid.length;
      const cols = board.grid[0]?.length || 0;

      // Calculate board-level effort
      // Ruby uses grid size (rows * cols) for field size effort
      const gridSize = rows * cols;
      let boardEffort = baseBoardEffort(rows, cols, gridSize);

      // Apply reuse discounts - iterate through grid cells like Ruby does
      let reuseDiscount = 0.0;
      board.grid.forEach((row: (AACButton | null)[]) => {
        row.forEach((btn: AACButton | null) => {
          if (!btn) return;

          if (btn.clone_id && setPcts[btn.clone_id]) {
            reuseDiscount +=
              EFFORT_CONSTANTS.REUSED_CLONE_FROM_OTHER_BONUS *
              setPcts[btn.clone_id];
          } else if (btn.semantic_id && setPcts[btn.semantic_id]) {
            reuseDiscount +=
              EFFORT_CONSTANTS.REUSED_SEMANTIC_FROM_OTHER_BONUS *
              setPcts[btn.semantic_id];
          }
        });
      });

      boardEffort = Math.max(0, boardEffort - reuseDiscount);

      // Calculate board link percentages
      const boardPcts = this.calculateBoardLinkPercentages(tree, board);

      // Get scanning configuration from page (if available)
      const blockScanEnabled = board.scanningConfig?.blockScanEnabled || false;

      // Process each button
      const priorScanBlocks = new Set<number>();
      const btnHeight = 1.0 / rows;
      const btnWidth = 1.0 / cols;

      board.grid.forEach((row: (AACButton | null)[], rowIndex: number) => {
        row.forEach((btn: AACButton | null, colIndex: number) => {
          // Skip null buttons and buttons with empty labels (matching Ruby behavior)
          if (!btn || (btn.label || "").length === 0) {
            // Don't count these toward prior_buttons (Ruby uses "next unless")
            return;
          }

          const x = btnWidth / 2 + btnWidth * colIndex;
          const y = btnHeight / 2 + btnHeight * rowIndex;

          // Calculate prior items for visual scan effort
          // If block scanning enabled, count unique scan blocks instead of individual buttons
          const priorItems = this.countScanItems(
            board,
            rowIndex,
            colIndex,
            priorScanBlocks,
            blockScanEnabled,
          );

          // Calculate button-level effort
          let buttonEffort = boardEffort;

          // Debug for specific button (disabled for production)
          const debugSpecificButton = btn.label === "$938c2cc0dc";
          if (debugSpecificButton) {
            console.log(
              `\n🔍 DEBUG Button ${btn.label} at [${rowIndex},${colIndex}] on ${board.id}:`,
            );
            console.log(
              `   Entry point: (${entryX.toFixed(4)}, ${entryY.toFixed(4)})`,
            );
            console.log(`   Current level: ${level}`);
            console.log(`   Starting effort: ${buttonEffort.toFixed(6)}`);
          }

          // Apply semantic_id discounts
          if (btn.semantic_id && boardPcts[btn.semantic_id]) {
            const discount =
              EFFORT_CONSTANTS.SAME_LOCATION_AS_PRIOR_DISCOUNT /
              boardPcts[btn.semantic_id];
            const old = buttonEffort;
            buttonEffort = Math.min(buttonEffort, buttonEffort * discount);
            if (debugSpecificButton)
              console.log(
                `   Semantic board discount: ${old.toFixed(6)} -> ${buttonEffort.toFixed(6)} (pct=${boardPcts[btn.semantic_id].toFixed(4)})`,
              );
          } else if (
            btn.semantic_id &&
            boardPcts[`upstream-${btn.semantic_id}`]
          ) {
            const discount =
              EFFORT_CONSTANTS.RECOGNIZABLE_SEMANTIC_FROM_PRIOR_DISCOUNT /
              boardPcts[`upstream-${btn.semantic_id}`];
            const old = buttonEffort;
            buttonEffort = Math.min(buttonEffort, buttonEffort * discount);
            if (debugSpecificButton)
              console.log(
                `   Semantic upstream discount: ${old.toFixed(6)} -> ${buttonEffort.toFixed(6)} (pct=${boardPcts[`upstream-${btn.semantic_id}`].toFixed(4)})`,
              );
          }

          // Apply clone_id discounts
          if (btn.clone_id && boardPcts[btn.clone_id]) {
            const discount =
              EFFORT_CONSTANTS.SAME_LOCATION_AS_PRIOR_DISCOUNT /
              boardPcts[btn.clone_id];
            buttonEffort = Math.min(buttonEffort, buttonEffort * discount);
          } else if (btn.clone_id && boardPcts[`upstream-${btn.clone_id}`]) {
            const discount =
              EFFORT_CONSTANTS.RECOGNIZABLE_CLONE_FROM_PRIOR_DISCOUNT /
              boardPcts[`upstream-${btn.clone_id}`];
            buttonEffort = Math.min(buttonEffort, buttonEffort * discount);
          }

          // Calculate button effort based on access method (Touch vs Scanning)
          const isScanning = !!board.scanningConfig || !!board.scanType;
          if (isScanning) {
            const { steps, selections } = this.calculateScanSteps(
              board,
              btn,
              rowIndex,
              colIndex,
            );
            let sEffort = scanningEffort(steps, selections);

            // Apply discounts to scanning effort (similar to touch)
            if (btn.semantic_id && boardPcts[btn.semantic_id]) {
              const discount =
                EFFORT_CONSTANTS.SAME_LOCATION_AS_PRIOR_DISCOUNT /
                boardPcts[btn.semantic_id];
              sEffort = Math.min(sEffort, sEffort * discount);
            } else if (btn.clone_id && boardPcts[btn.clone_id]) {
              const discount =
                EFFORT_CONSTANTS.SAME_LOCATION_AS_PRIOR_DISCOUNT /
                boardPcts[btn.clone_id];
              sEffort = Math.min(sEffort, sEffort * discount);
            }

            buttonEffort += sEffort;
          } else {
            // Add distance effort (Touch only)
            let distance = distanceEffort(x, y, entryX, entryY);

            // Apply distance discounts
            if (btn.semantic_id) {
              if (boardPcts[btn.semantic_id]) {
                const discount =
                  EFFORT_CONSTANTS.SAME_LOCATION_AS_PRIOR_DISCOUNT /
                  boardPcts[btn.semantic_id];
                distance = Math.min(distance, distance * discount);
              } else if (boardPcts[`upstream-${btn.semantic_id}`]) {
                const discount =
                  EFFORT_CONSTANTS.RECOGNIZABLE_SEMANTIC_FROM_PRIOR_DISCOUNT /
                  boardPcts[`upstream-${btn.semantic_id}`];
                distance = Math.min(distance, distance * discount);
              } else if (level > 0 && setPcts[btn.semantic_id]) {
                const discount =
                  EFFORT_CONSTANTS.RECOGNIZABLE_SEMANTIC_FROM_OTHER_DISCOUNT /
                  setPcts[btn.semantic_id];
                distance = Math.min(distance, distance * discount);
              }
            }
            if (btn.clone_id) {
              if (boardPcts[btn.clone_id]) {
                const discount =
                  EFFORT_CONSTANTS.SAME_LOCATION_AS_PRIOR_DISCOUNT /
                  boardPcts[btn.clone_id];
                distance = Math.min(distance, distance * discount);
              } else if (boardPcts[`upstream-${btn.clone_id}`]) {
                const discount =
                  EFFORT_CONSTANTS.RECOGNIZABLE_CLONE_FROM_PRIOR_DISCOUNT /
                  boardPcts[`upstream-${btn.clone_id}`];
                distance = Math.min(distance, distance * discount);
              } else if (level > 0 && setPcts[btn.clone_id]) {
                const discount =
                  EFFORT_CONSTANTS.RECOGNIZABLE_CLONE_FROM_OTHER_DISCOUNT /
                  setPcts[btn.clone_id];
                distance = Math.min(distance, distance * discount);
              }
            }

            buttonEffort += distance;

            // Add visual scan or local scan effort
            if (
              distance >
                EFFORT_CONSTANTS.DISTANCE_THRESHOLD_TO_SKIP_VISUAL_SCAN ||
              (entryX === 1.0 && entryY === 1.0)
            ) {
              buttonEffort += visualScanEffort(priorItems);
            } else {
              buttonEffort += localScanEffort(distance);
            }
          }

          // Add cumulative prior effort
          buttonEffort += priorEffort;

          // Track scan blocks for block scanning, otherwise track individual buttons
          if (blockScanEnabled) {
            const scanBlockId = btn.scanBlock ?? btn.scanBlocks?.[0];
            if (scanBlockId !== undefined && scanBlockId !== null) {
              priorScanBlocks.add(scanBlockId);
            }
          }

          // Handle navigation buttons
          if (btn.targetPageId) {
            const nextBoard = tree.getPage(btn.targetPageId);
            if (nextBoard) {
              // Only add to toVisit if this board hasn't been visited yet at any level
              // The visitedBoardIds map stores the *lowest* level a board was visited.
              // If it's already in the map, it means we've processed it or scheduled it at a lower level.
              if (visitedBoardIds.get(nextBoard.id) === undefined) {
                const changeEffort =
                  EFFORT_CONSTANTS.BOARD_CHANGE_PROCESSING_EFFORT;
                const tempHomeId =
                  btn.semanticAction?.platformData?.grid3?.parameters
                    ?.temporary_home === "prior"
                    ? board.id
                    : btn.semanticAction?.platformData?.grid3?.parameters
                          ?.temporary_home === true
                      ? btn.targetPageId
                      : temporaryHomeId;

                toVisit.push({
                  board: nextBoard,
                  level: level + 1,
                  priorEffort: buttonEffort + changeEffort,
                  temporaryHomeId: tempHomeId,
                  entryX: x,
                  entryY: y,
                  entryCloneId: btn.clone_id,
                  entrySemanticId: btn.semantic_id,
                });
              }
            }
          }

          // Track word if it speaks or adds to sentence
          const intent = String(btn.semanticAction?.intent || "");
          const isSpeak =
            btn.semanticAction?.category ===
              AACSemanticCategory.COMMUNICATION ||
            intent === "SPEAK_TEXT" ||
            intent === "SPEAK_IMMEDIATE" ||
            intent === "INSERT_TEXT" ||
            btn.semanticAction?.fallback?.type === "SPEAK";
          const addToSentence =
            btn.semanticAction?.platformData?.grid3?.parameters
              ?.add_to_sentence ||
            btn.semanticAction?.fallback?.add_to_sentence;

          if (isSpeak || addToSentence) {
            let finalEffort = buttonEffort;

            // Apply Board Change Processing Effort Discount (matching Ruby lines 347-350)
            const changeEffort =
              EFFORT_CONSTANTS.BOARD_CHANGE_PROCESSING_EFFORT;
            if (btn.clone_id && boardPcts[btn.clone_id]) {
              const discount = Math.min(
                changeEffort,
                (changeEffort * 0.3) / boardPcts[btn.clone_id],
              );
              finalEffort -= discount;
            } else if (btn.semantic_id && boardPcts[btn.semantic_id]) {
              const discount = Math.min(
                changeEffort,
                (changeEffort * 0.5) / boardPcts[btn.semantic_id],
              );
              finalEffort -= discount;
            }

            const existing = knownButtons.get(btn.label);
            const knownBtn: ButtonMetrics = {
              id: btn.id,
              label: btn.label,
              level,
              effort: finalEffort,
              count: (existing?.count || 0) + 1,
              semantic_id: btn.semantic_id,
              clone_id: btn.clone_id,
              temporary_home_id: temporaryHomeId || undefined,
            };

            if (!existing || finalEffort < existing.effort) {
              knownButtons.set(btn.label, knownBtn);
            }
          }
        });
      });
    }

    // Convert to array and group by level
    const buttons = Array.from(knownButtons.values());
    buttons.forEach((btn) => {
      if (!levels[btn.level]) {
        levels[btn.level] = [];
      }
      levels[btn.level].push(btn);
    });

    return {
      buttons,
      levels,
      totalButtons: buttons.length,
    };
  }

  /**
   * Calculate what percentage of links to this board match semantic_id/clone_id
   */
  private calculateBoardLinkPercentages(
    tree: AACTree,
    board: AACPage,
  ): { [id: string]: number } {
    const boardPcts: { [id: string]: number } = {};
    let totalLinks = 0;

    Object.values(tree.pages).forEach((sourceBoard: AACPage) => {
      sourceBoard.buttons.forEach((btn: AACButton) => {
        if (btn.targetPageId === board.id) {
          totalLinks++;
          if (btn.semantic_id) {
            boardPcts[btn.semantic_id] = (boardPcts[btn.semantic_id] || 0) + 1;
          }
          if (btn.clone_id) {
            boardPcts[btn.clone_id] = (boardPcts[btn.clone_id] || 0) + 1;
          }

          // Also count IDs present on the source board that links to this one
          sourceBoard.semantic_ids?.forEach((id: string) => {
            boardPcts[`upstream-${id}`] =
              (boardPcts[`upstream-${id}`] || 0) + 1;
          });
          sourceBoard.clone_ids?.forEach((id: string) => {
            boardPcts[`upstream-${id}`] =
              (boardPcts[`upstream-${id}`] || 0) + 1;
          });
        }
      });
    });

    // Convert counts to percentages
    if (totalLinks > 0) {
      Object.keys(boardPcts).forEach((id) => {
        boardPcts[id] = boardPcts[id] / totalLinks;
      });
    }

    boardPcts["all"] = totalLinks;
    return boardPcts;
  }

  /**
   * Calculate grid dimensions from the tree
   */
  private calculateGridDimensions(tree: AACTree): {
    rows: number;
    columns: number;
  } {
    let totalRows = 0;
    let totalCols = 0;
    let count = 0;

    Object.values(tree.pages).forEach((page: AACPage) => {
      totalRows += page.grid.length;
      totalCols += page.grid[0]?.length || 0;
      count++;
    });

    return {
      rows: Math.round(totalRows / count),
      columns: Math.round(totalCols / count),
    };
  }

  /**
   * Calculate scanning steps and selections for a button based on access method
   */
  private calculateScanSteps(
    board: AACPage,
    btn: AACButton,
    rowIndex: number,
    colIndex: number,
  ): { steps: number; selections: number } {
    // Determine scanning type from local scanType or scanningConfig
    let type: AACScanType = board.scanType || AACScanType.LINEAR;
    if (board.scanningConfig?.cellScanningOrder) {
      const order = board.scanningConfig.cellScanningOrder;
      // String matching for CellScanningOrder
      if (order === CellScanningOrder.RowColumnScan)
        type = AACScanType.ROW_COLUMN;
      else if (order === CellScanningOrder.ColumnRowScan)
        type = AACScanType.COLUMN_ROW;
      else if (order === CellScanningOrder.SimpleScanColumnsFirst)
        type = AACScanType.COLUMN_ROW;
      else if (order === CellScanningOrder.SimpleScan)
        type = AACScanType.LINEAR;
    }

    // Force block scan if enabled in config
    const isBlockScan =
      board.scanningConfig?.blockScanEnabled ||
      type === AACScanType.BLOCK_ROW_COLUMN ||
      type === AACScanType.BLOCK_COLUMN_ROW;

    if (isBlockScan) {
      const blockId =
        btn.scanBlock ||
        (btn.scanBlocks && btn.scanBlocks.length > 0
          ? btn.scanBlocks[0]
          : null);

      // If no block assigned, treat as its own block at the end (fallback)
      if (blockId === null) {
        return { steps: rowIndex + colIndex + 1, selections: 1 };
      }

      const config = board.scanBlocksConfig?.find((c) => c.id === blockId);
      const blockOrder = config?.order ?? blockId;

      // Linear scan within the block
      let btnInBlockIndex = 0;
      let found = false;
      for (let r = 0; r < board.grid.length; r++) {
        for (let c = 0; c < (board.grid[r]?.length || 0); c++) {
          const b = board.grid[r][c];
          if (
            b &&
            (b.scanBlock === blockId || b.scanBlocks?.includes(blockId))
          ) {
            if (b === btn) {
              found = true;
              break;
            }
            btnInBlockIndex++;
          }
        }
        if (found) break;
      }

      // 1 selection for block, 1 for item
      return { steps: blockOrder + btnInBlockIndex + 1, selections: 2 };
    }

    switch (type) {
      case AACScanType.LINEAR: {
        let index = 0;
        let found = false;
        for (let r = 0; r < board.grid.length; r++) {
          for (let c = 0; c < board.grid[r].length; c++) {
            const b = board.grid[r][c];
            if (b && (b.label || "").length > 0) {
              if (b === btn) {
                found = true;
                break;
              }
              index++;
            }
          }
          if (found) break;
        }
        return { steps: index + 1, selections: 1 };
      }

      case AACScanType.ROW_COLUMN:
        return { steps: rowIndex + 1 + (colIndex + 1), selections: 2 };

      case AACScanType.COLUMN_ROW:
        return { steps: colIndex + 1 + (rowIndex + 1), selections: 2 };

      default:
        return { steps: rowIndex + 1 + (colIndex + 1), selections: 2 };
    }
  }
}
