# BUG-HS-001: Cannot book a room on the day another guest checks out

**Labels:** `homestay` `bug` `layer::backend` `P1` · **Branch:** `feat/seed-bug` · **Reporter:** Front desk

## Summary
A guest tried to book Room 101 from 12 to 14 of the month. The system said the room is not available, but the only other booking for that room ends on the 12th (check-out morning). Front desk says the room is empty from the 12th, so the new guest should be able to book.

## Steps to reproduce (as reported)
1. Room 101 has one active booking: check-in 10, check-out 12.
2. Log in as a different guest.
3. Try to book Room 101 with check-in 12, check-out 14 (via UI or AI assistant).

## Expected
Booking is created. Check-out day is free for the next guest.

## Actual
Booking is rejected: `Room "<id>" is not available for the selected dates` (HTTP 409). The AI assistant also tells the guest the room is unavailable.

## Notes from reporter
- Happened on 2 different rooms, so probably not data related.
- Booking 14-16 (one day gap) works fine.
- Not sure if it also affects editing a booking.

## Your task
Reproduce it, find the root cause, propose a fix, and list the tests that should have caught it. Do not guess: show the evidence.
