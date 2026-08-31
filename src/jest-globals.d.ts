// Fix: @types/jest@30 no longer declares `jest` as a global variable.
// Jest injects `jest` at runtime; this makes the type checker aware of it.
/// <reference types="jest" />
declare const jest: jest.Jest;
