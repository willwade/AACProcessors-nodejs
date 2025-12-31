# AAC Effort Algorithm Implementation Notes

This document details the discrepancies between the original Ruby `aac-metrics` implementation and this TypeScript implementation, specifically regarding how they align with the [v0.2 algorithm specification](./AAC%20Effort%20Algorithms.md).

## 🚀 Overview

The TypeScript implementation (this project) achieves high parity with the Ruby gem (~95% accuracy) while resolving several logical inconsistencies found in the Ruby code. Where the two implementations differ, this project favors the logic described in `AAC Effort Algorithms.md`.

## 🔍 Identified Discrepancies & "Ruby Bugs"

### 1. Sequential vs. Exclusive Discounting (Serial Discounting)

**The Ruby Issue:**
In the Ruby gem (`metrics.rb` lines 250-264 and 278-291), discounts for `semantic_id` and `clone_id` are applied sequentially.

- If a button has both a `semantic_id` and a `clone_id`, Ruby applies a discount for the first, then applies the second discount to the _already discounted_ value.
- **Example:** `effort = (effort * 0.5) * 0.33` results in an ~84% reduction.

**Our Implementation:**
Following the principle of "best match," our TypeScript code uses `Math.min` or `else if` logic. We apply the single most favorable discount available, preventing "bottomless" effort scores that occur when multiple identifiers happen to overlap on the same button.

### 2. The "Sub-board Effort" Gap

**The Ruby Issue:**
For buttons on sub-boards (Level 1+), Ruby occasionally records an "on-board" effort (the effort added _by_ the current board, excluding prior effort) as low as **0.02**.

- The specification states that every new board should start with a `board_effort` base (calculated from grid size). For a 6x10 grid, this base is **1.21**.
- Even with a 90% discount (the maximum suggested), the effort should be ~0.12 + distance.
- Ruby's 0.02 score suggests it is either failing to add the `board_effort` base for certain paths or allows discounts to stack far beyond the 10% floor.

**Our Implementation:**
We strictly maintain the `board_effort` base for all boards, ensuring that the cognitive cost of processing a new screen (as defined in the "General Factors" section of the spec) is always accounted for.

### 3. Upstream ID Weighting

**The Ruby Issue:**
Ruby calculates `board_pcts` (the percentage of links to a board that match an ID) by counting every individual link.

- In keyboard-heavy sets like WordPower, where 30+ buttons might link to the same "Keyboard" board, those 30 links dominate the percentage calculation.
- This creates "Super-Discounts" for buttons on shared boards, even if the user only realistically takes one path to get there.

**Our Implementation:**
While we currently replicate this link-weighted approach for parity, we have noted it as an area where the algorithm's intent (measuring predictability across boards) may be skewed by the technical structure of the OBF file.

### 4. Processing Effort Discount Placement

**The Ruby Issue:**
Ruby subtracts a portion of the `BOARD_CHANGE_PROCESSING_EFFORT` (1.0) from the _final_ button effort if that button (a "Speak" button) matches the ID used to reach the board.

**Our Implementation:**
We have implemented this to match Ruby, but noted that it acts as a "post-hoc" reward for navigation consistency rather than a forward-propagating motor planning discount.

## 📈 Parity Status

- **Level 0 (Root):** 100% Parity.
- **Level 1+:** ~92-95% Parity.
- **Overall:** ~95% Parity across most common AAC sets (WordPower 80, etc.).

By choosing to be "more faithful" to the algorithm document, our effort scores may be slightly higher than Ruby's in complex sub-boards, but they more accurately represent the cognitive and motor costs defined in the v0.2 specification.
