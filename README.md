# EliteMess - Premium Mess Management System Webapp

An elegant, modern, high-fidelity, and offline-first Single Page Application (SPA) designed to manage shared boarding houses, bachelor messes, hostels, or apartments. It tracks daily meals, deposits, bazaar expenses, and utility bill splits with a premium glassmorphic dark/light UI/UX.

---

## 🚀 Key Features

- **Dynamic Financial Dashboard**: Live calculation of Meal Rate, Total Expenses, and Active Cash Box Balance.
- **Visual Analytics**: Dynamic progress bars and standing charts reflecting each member's deposit credits and dues.
- **Day-by-Day Interactive Meal Book**: Matrix logging interface for daily Breakfast, Lunch, and Dinner (supports fractional meals e.g. 0.5 breakfasts).
- **Comprehensive Expense Tracker**:
  - **Bazaar Logger**: Records grocery receipts to credit the purchaser's ledger.
  - **Other / Utility bills**: Log collective shared expenses (electricity, Wi-Fi, maid, gas, water) which are equally split among members.
- **Detailed Member Ledgers**: Personal accounts summary displaying complete deposit, bazaar contribution, and meal records.
- **Printable Audit Statements**: Professional, clean settlement report formatted with signature sections, ready to print or save as PDF.
- **100% Client-Side Privacy**: Data is preserved entirely inside your browser's `LocalStorage`.
- **Seamless Database Backups**: One-click **JSON Export** to backup your complete mess records and **JSON Import** to instantly restore databases.

---

## 🧮 How It Works (Calculation Formula)

The application follows the standard standard mess mathematical accounting principles:

1. **Total Meals**  
   $$\text{Total Meals} = \sum (\text{Breakfast} + \text{Lunch} + \text{Dinner}) \quad [\text{for all days, all members}]$$
   *(Note: Breakfast defaults to 0.5 or custom; Lunch/Dinner is 1.0)*

2. **Total Bazaar Cost**  
   $$\text{Total Bazaar} = \sum (\text{Bazaar Expenses logged by all members})$$

3. **Dynamic Meal Rate**  
   $$\text{Meal Rate} = \frac{\text{Total Bazaar Cost}}{\text{Total Meals Eaten}}$$

4. **Shared/Fixed Cost per Member**  
   $$\text{Individual Shared Cost} = \frac{\text{Sum of Utilities, Gas, Wi-Fi, Rent, Helper Salaries}}{\text{Total Registered Active Members}}$$

5. **Net Balance Calculation (Financial Equilibrium)**  
   $$\text{Net Balance} = (\text{Total Deposits by Member} + \text{Bazaar Cost done by Member}) - (\text{Individual Meal Cost} + \text{Individual Shared Cost})$$
   
   - **Positive Balance ($+$):** Refund Due. The mess cash box owes this member money.
   - **Negative Balance ($-$):** Debt Due. The member must pay this outstanding sum to the mess manager to settle the account.
   - **Equilibrium:** The sum of all member balances always equals exactly **zero** ($\sum \text{Net Balance} = 0$), guaranteeing absolute double-entry audit balancing.

---

## 🛠️ Offline-First & No Build Configuration

This application has been developed using **Vanilla Web Technologies (HTML5, Modern CSS Variables, Modular Vanilla JS)**.
- **Zero build steps**: No `npm install`, no server requirements, and zero risk of node_modules corruption.
- **Instant Launch**: Simply double-click **`index.html`** in any web browser to open the application instantly.
- **Deploy to Vercel / GitHub**: Highly portable structure. Because it relies purely on static client-side resources, it can be deployed on platforms like **Vercel** or **GitHub Pages** in under 5 seconds with zero build settings.

---

## 📦 How to Publish on GitHub & Vercel (Step-by-Step)

If you would like to host this online so all mess mates can log in and view reports, follow this guide:

### Step 1: Initialize Git and Commit
We have pre-configured a Git repository inside your local folder. To create a repository and save the state:
```bash
# 1. Inside the directory, verify Git is initialized:
git init

# 2. Add files and make initial commit:
git add .
git commit -m "Initial commit of EliteMess System"
```

### Step 2: Create a GitHub Repository & Push
1. Go to [github.com](https://github.com) and click **New Repository**.
2. Name your repository (e.g., `my-mess-management`). Choose **Public** or **Private** and click **Create**.
3. Link your local project and push (replace `<username>` and `<repo-name>` with your details):
```bash
git remote add origin https://github.com/<username>/<repo-name>.git
git branch -M main
git push -u origin main
```

### Step 3: Deploy to Vercel (1-Click)
1. Go to [vercel.com](https://vercel.com) and log in with your GitHub account.
2. Click **Add New** -> **Project**.
3. Find your `my-mess-management` repository and click **Import**.
4. Vercel will automatically detect it is a **Static Site** (no build steps needed).
5. Click **Deploy**! 

*Your premium EliteMess web application will be live on a secure HTTPS URL in less than 10 seconds! 🎉*
