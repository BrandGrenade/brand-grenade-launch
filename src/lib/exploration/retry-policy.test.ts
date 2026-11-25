import {describe,expect,it} from 'vitest';
import {terminalExplorationError} from './retry-policy';
describe('exploration permanent errors stop the background chain',()=>{
 for(const status of [400,401,402,403,404])it(`Claude API ${status} is terminal`,()=>{
  expect(terminalExplorationError(`Claude API ${status}: unavailable request`)).toBe(true);
 });
 it('an HTTP 200 provider refusal is terminal',()=>expect(terminalExplorationError('Claude stop_reason=refusal: provider declined')).toBe(true));
 it('credit exhaustion is terminal',()=>expect(terminalExplorationError('Insufficient credit balance')).toBe(true));
 it('an unreadable result may use the bounded validation retry',()=>expect(terminalExplorationError('Unexpected token in JSON')).toBe(false));
 it('transient upstream failure is not a permanent denial',()=>expect(terminalExplorationError('Claude API 503: unavailable service')).toBe(false));
});