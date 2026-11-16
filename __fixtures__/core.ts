/**
 * This file is used to mock the `@actions/core` module in tests.
 */
import { jest } from "@jest/globals";

export const debug = jest.fn();
export const error = jest.fn();
export const info = jest.fn();
export const getInput = jest.fn<(name: string, opts?: unknown) => string>();
export const getState = jest.fn<(name: string) => string>();
export const saveState = jest.fn();
export const setSecret = jest.fn();
export const setOutput = jest.fn();
export const setFailed = jest.fn();
export const warning = jest.fn();
