# Jira Clone Backend

A production-grade SaaS backend foundation built with NestJS and PostgreSQL.

## 🚀 Features

- **Clean Architecture**: Modular folder structure for scalability
- **TypeScript**: Full type safety and modern JavaScript features
- **PostgreSQL**: Robust relational database with TypeORM
- **Environment Configuration**: Secure configuration management with dotenv
- **Validation**: Global validation pipes with class-validator
- **Production Ready**: Configured for production deployment

## 📁 Project Structure

```
src/
├── modules/       # Business logic modules (to be added)
├── common/        # Shared utilities, guards, interceptors
├── config/        # Configuration files
├── database/      # Database migrations and seeds
└── main.ts        # Application entry point
```

## 🛠️ Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)
- npm or yarn

## 📦 Installation

1. **Clone the repository**
   ```bash
   cd jira-clone-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Update the `.env` file with your PostgreSQL credentials:
   ```env
   PORT=5000
   DATABASE_HOST=localhost
   DATABASE_PORT=5432
   DATABASE_USER=postgres
   DATABASE_PASSWORD=your_actual_password
   DATABASE_NAME=jira_clone_db
   ```

4. **Create the database**
   ```bash
   # Connect to PostgreSQL
   psql -U postgres
   
   # Create database
   CREATE DATABASE jira_clone_db;
   ```

## 🏃 Running the Application

### Development Mode
```bash
npm run start:dev
```

### Production Mode
```bash
npm run build
npm run start:prod
```

### Debug Mode
```bash
npm run start:debug
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 📝 Available Scripts

- `npm run start` - Start the application
- `npm run start:dev` - Start in watch mode
- `npm run start:debug` - Start in debug mode
- `npm run start:prod` - Start production build
- `npm run build` - Build the application
- `npm run format` - Format code with Prettier
- `npm run lint` - Lint code with ESLint

## 🔧 Technology Stack

- **Framework**: NestJS
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: TypeORM
- **Validation**: class-validator, class-transformer
- **Configuration**: @nestjs/config, dotenv

## 📚 Next Steps

This is a foundation setup. To build your Jira clone, you'll need to add:

1. **Authentication Module**: User registration, login, JWT tokens
2. **User Module**: User management and profiles
3. **Project Module**: Project creation and management
4. **Board Module**: Kanban boards and workflows
5. **Issue Module**: Issue/ticket management
6. **Sprint Module**: Sprint planning and tracking
7. **Comment Module**: Comments and activity tracking

## 🔐 Security Notes

- Never commit `.env` file to version control
- Update `DATABASE_PASSWORD` with a strong password
- Use environment-specific configuration for production
- Enable CORS appropriately for your frontend
- Implement rate limiting for API endpoints

## 📄 License

This project is licensed under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please follow the existing code structure and conventions.

---

Built with ❤️ using NestJS
