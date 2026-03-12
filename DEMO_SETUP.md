# Zebri Demo Setup Guide

This guide explains how to set up demo data for vendor demos or testing.

## Quick Start

1. **Create a test user in Supabase Auth**
   - Go to your Supabase dashboard
   - Navigate to Authentication > Users
   - Create a new user with email (e.g., `demo@zebri.com`) and password
   - Copy the user ID (UUID)

2. **Run the demo migration**
   - Open `supabase/migrations/20260312010000_insert_demo_data.sql`
   - Replace all instances of `'DEMO_USER_ID'` with the actual user ID from step 1
   - Run the migration in your Supabase SQL editor

3. **Log in and explore**
   - Log in with the demo user credentials
   - Navigate to the Dashboard to see all stats populated with sample data

## What's Included in the Demo Data

### Couples (5 samples)
- **Sarah & Michael Johnson** - Confirmed, April 15 wedding (45 days old)
- **Emma & James Chen** - Contacted, March 28 wedding (30 days old)
- **Olivia & David Miller** - New enquiry, May 10 wedding (5 days old)
- **Jessica & Tom Wilson** - Paid deposit, April 22 wedding (20 days old)
- **Sophie & Alex Taylor** - Completed wedding (90 days old, for YoY comparison)

### Vendors (7 samples)
- Elegance Photography (active)
- Cinematic Dreams Films (active)
- Florist & Botanicals (active)
- The Gourmet Kitchen (active)
- DJ Phoenix Entertainment (active)
- Artistry Hair & Makeup (active)
- Premier Events Planning (inactive - for filter testing)

### Events & Tasks
- 4 upcoming events with vendor assignments
- 5 tasks with various statuses (todo, in_progress, done)
- Associations between couples and vendors

## Dashboard Stats That Will Show Data

After running the migration, you'll see:
- **New Enquiries**: 5 couples contacted this month (with YoY comparison if you have historical data)
- **Open Tasks**: 4 tasks pending/in-progress
- **Weddings (next 30 days)**: 3-4 events scheduled
- **Completed this month**: 1 completed wedding
- **Active Vendors**: 6 active vendors
- **Due this week**: Tasks with upcoming due dates

## Testing Features

This demo data is designed to test:
- Dashboard stat cards with real data
- Year-over-year comparisons
- Vendor assignment workflows
- Task management
- Calendar/upcoming weddings views
- Status filtering and searches

## Tips for Demos

1. **Show the timeline** - Walk through the couple journey from "new" → "contacted" → "confirmed" → "paid" → "complete"
2. **Highlight vendors** - Show how vendors are assigned to couples and events
3. **Discuss tasks** - Demonstrate the task management for wedding day coordination
4. **Explain stats** - Point out the YoY comparisons and how they track business growth

## Resetting Demo Data

To remove demo data and start fresh:
1. Go to Supabase dashboard
2. Delete the demo user
3. Data associated with that user will be cleaned up via foreign keys
4. Create a new user and re-run the migration with the new user ID

---

**Note**: This demo data is designed for a single user. For multi-user demos, create additional users and run the migration for each with their own user ID.
