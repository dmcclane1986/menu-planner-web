# Menu Planning App - Project Synopsis

## ✅ Completed Features

### 1. **Project Setup**
   - Next.js 14 with TypeScript
   - Tailwind CSS with dark mode and orange accents
   - InstantDB database integration
   - Magic code authentication

### 2. **Authentication**
   - Login/signup pages with magic code
   - Protected routes
   - User management

### 3. **Household Management** (`/household`)
   - Create households
   - Join households with codes
   - Head of Household role
   - Multiple household support
   - Display popularity threshold (read-only)

### 4. **Menu Items CRUD** (`/menu`)
   - Create, read, update, delete menu items
   - Genre categorization (Italian, Mexican, Asian, American, Other)
   - Soft delete (hide items)
   - Popularity scores
   - View hidden items / restore functionality

### 5. **Recipes CRUD** (`/recipes`)
   - Create, read, update, delete recipes
   - Link recipes to menu items
   - Ingredients management (name, quantity, unit)
   - Instructions, prep time, cook time, servings (all optional)

### 6. **Menu Calendar View** (`/menu/calendar`)
   - Weekly and monthly calendar views
   - Add menu items to specific dates and meal types
   - Edit/delete menu plans
   - Navigate between weeks/months
   - **Voting system** with upvote/downvote buttons
   - Real-time vote counts

### 7. **Shopping Lists** (`/shopping`)
   - Generate shopping lists from weekly menu plans
   - **Select any future week** (not just current week)
   - Aggregate ingredients from recipes
   - Check/uncheck items
   - Add manual items
   - Edit quantities and units
   - View and manage shopping lists

### 8. **AI Menu Generation** (`/menu/ai`)
   - OpenAI integration to generate menus
   - Checkbox form for selecting days/meals
   - **Caching** to avoid unnecessary API calls
   - **Uses voting data** to prefer popular items
   - Dietary instructions integration
   - Genre preference weights

### 9. **Dietary Instructions**
   - Save dietary preferences per household
   - Quick-add buttons for common restrictions
   - Used by AI when generating menus
   - Persistent storage

### 10. **Voting System**
   - Upvote/downvote menu plans in calendar
   - Real-time vote counts
   - Updates menu item popularity scores
   - Visual feedback for user's votes

### 11. **Popularity Threshold Logic**
   - Automatically hides items below threshold
   - Default threshold: -5 (configurable per household)
   - Items auto-hide/show based on votes
   - Currently only displayed, not editable in UI

---

## 📋 Remaining Steps / Potential Improvements

### 🔴 High Priority

1. **Popularity Threshold Configuration**
   - Allow Head of Household to edit the threshold
   - Add UI in household settings page
   - Currently only displayed, not editable

2. **Month View Voting**
   - Voting buttons only in week view
   - Add voting to month view for consistency

3. **View/Restore Hidden Menu Items**
   - Show hidden items in menu items page
   - Allow restoring items that were auto-hidden
   - Currently items can be hidden but not easily viewed/restored

### 🟡 Medium Priority

4. **Enhanced Shopping List Features**
   - Export/print shopping lists
   - Share shopping lists with household members
   - Shopping list templates

5. **Search and Filtering**
   - Search menu items by name/genre
   - Filter recipes by menu item
   - Search shopping lists

6. **Statistics/Analytics**
   - Most popular menu items dashboard
   - Voting statistics
   - Meal planning frequency
   - Shopping list history

### 🟢 Low Priority / Nice to Have

7. **Notifications/Reminders**
   - Meal reminders
   - Shopping list reminders
   - New menu plan notifications

8. **Mobile Responsiveness**
   - Optimize calendar view for mobile
   - Touch-friendly voting buttons
   - Mobile shopping list experience

9. **Recipe Enhancements**
   - Recipe images
   - Recipe ratings/reviews
   - Recipe sharing between households


---

## 📊 Summary

**Status:** Core features are complete! The app is fully functional and supports:
- Multi-user households
- Menu planning with calendar
- Recipe management
- Shopping list generation
- AI-powered menu generation
- Voting and popularity tracking

**Main Gaps:**
1. Popularity threshold configuration UI
2. Month view voting
3. View/restore hidden items

---

## 🛠️ Tech Stack

- **Frontend:** Next.js 14, TypeScript, React
- **Styling:** Tailwind CSS (dark mode, orange accents)
- **Database:** InstantDB
- **Authentication:** Magic code (InstantDB)
- **AI:** OpenAI GPT-4o-mini

---

## 📁 Project Structure

```
app/(dashboard)/
├── household/          # Household management
├── menu/
│   ├── page.tsx       # Menu items CRUD
│   ├── calendar/      # Calendar view with voting
│   └── ai/            # AI menu generation
├── recipes/           # Recipe management
└── shopping/          # Shopping lists

lib/
├── instantdb/         # Database config & schema
└── utils/            # Utility functions
    ├── menu.ts
    ├── recipes.ts
    ├── menuPlans.ts
    ├── shoppingLists.ts
    ├── votes.ts
    └── aiPreferences.ts

app/api/
└── ai/
    └── generate-menu/ # OpenAI integration
```

---

*Last Updated: Current Session*

