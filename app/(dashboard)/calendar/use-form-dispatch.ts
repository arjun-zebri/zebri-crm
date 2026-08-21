/**
 * Form dispatch handler factory.
 *
 * Reduces boilerplate when wiring form fields to a reducer dispatcher.
 *
 * @module app/(dashboard)/calendar/use-form-dispatch
 */

import type { FormAction } from './meeting-type-form';

/**
 * Create form field setters bound to a reducer dispatcher.
 */
export function createFormSetters(
  dispatch: React.Dispatch<FormAction>,
) {
  return {
    setName: (value: string) => dispatch({ type: 'set', payload: { name: value } }),
    setDescription: (value: string) => dispatch({ type: 'set', payload: { description: value } }),
    setDurationMinutes: (value: string) => dispatch({ type: 'set', payload: { durationMinutes: value } }),
    setLocationType: (value: string) => dispatch({ type: 'set', payload: { locationType: value } }),
    setAddress: (value: string) => dispatch({ type: 'set', payload: { address: value } }),
    setBufferBeforeMinutes: (value: string) => dispatch({ type: 'set', payload: { bufferBeforeMinutes: value } }),
    setBufferAfterMinutes: (value: string) => dispatch({ type: 'set', payload: { bufferAfterMinutes: value } }),
    setMinNoticeHours: (value: string) => dispatch({ type: 'set', payload: { minNoticeHours: value } }),
    setMaxAdvanceDays: (value: string) => dispatch({ type: 'set', payload: { maxAdvanceDays: value } }),
    setReminderEnabled: (value: boolean) => dispatch({ type: 'set', payload: { reminderEnabled: value } }),
    setActive: (value: boolean) => dispatch({ type: 'set', payload: { active: value } }),
  };
}
