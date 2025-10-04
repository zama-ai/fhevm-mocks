# Bug Report - FHEVM Mocks

## Critical Bugs Found

### 1. 🔴 CRITICAL: Incorrect bit length validation in `assertIsBigUint160`

**File**: `packages/mock-utils/src/utils/math.ts:146`

**Issue**: The function `assertIsBigUint160` incorrectly passes `128` as the bit length parameter instead of `160`.

**Current Code**:
```typescript
export function assertIsBigUint160(value: unknown, valueName?: string): asserts value is bigint {
  _assertIsBigUint(value, 128, MAX_UINT160, valueName);  // ❌ WRONG: should be 160, not 128
}
```

**Expected Code**:
```typescript
export function assertIsBigUint160(value: unknown, valueName?: string): asserts value is bigint {
  _assertIsBigUint(value, 160, MAX_UINT160, valueName);  // ✅ CORRECT
}
```

**Impact**: This bug could lead to incorrect validation errors when working with uint160 values, potentially causing runtime failures or incorrect error messages.

---

### 2. ⚠️ MODERATE: Incorrect type for `private` field in package.json

**File**: `packages/mock-utils/package.json:2`

**Issue**: The `private` field is set as a string `"true"` instead of a boolean `true`.

**Current Code**:
```json
{
  "private": "true",
  ...
}
```

**Expected Code**:
```json
{
  "private": true,
  ...
}
```

**Impact**: While npm may handle this gracefully, it's not the correct JSON type and could cause issues with certain tooling or strict parsers.

---

### 3. ⚠️ MODERATE: Incorrect workspace configuration

**File**: `package.json:6-10`

**Issue**: The workspaces array contains an unnecessary entry `"packages/mock-utils/src"` which is not a valid npm workspace (it's a subdirectory of an existing workspace).

**Current Code**:
```json
{
  "workspaces": [
    "packages/mock-utils",
    "packages/mock-utils/src",  // ❌ WRONG: not a separate workspace
    "packages/hardhat-plugin/"
  ]
}
```

**Expected Code**:
```json
{
  "workspaces": [
    "packages/mock-utils",
    "packages/hardhat-plugin/"
  ]
}
```

**Impact**: This could cause confusion or potential issues with npm workspace commands, and may lead to unexpected behavior during dependency installation or workspace operations.

---

### 4. 🔵 MINOR: Typo in filename

**File**: `packages/hardhat-plugin/src/type-extentions.ts`

**Issue**: The filename contains a typo: "extentions" should be "extensions".

**Expected**: `packages/hardhat-plugin/src/type-extensions.ts`

**Impact**: While this doesn't affect functionality, it's a spelling mistake that should be corrected for code clarity and professionalism. This requires updating the filename and all import statements referencing it.

---

## Summary

- **Total Bugs Found**: 4
  - Critical: 1
  - Moderate: 2
  - Minor: 1

## Testing Recommendations

After fixing these bugs:

1. Run full test suite: `npm test`
2. Verify workspace functionality: `npm install` (clean install)
3. Test uint160 validation specifically
4. Run linter: `npm run lint`

## Additional Notes

Several TODO comments were found in the codebase, indicating areas for future improvement, but these are not active bugs.

