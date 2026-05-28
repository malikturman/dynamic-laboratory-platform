import { laboratories } from '../data/laboratories';
import type { AppUser, LaboratoryId } from '../types';

const USERS_STORAGE_KEY = 'dynamic-laboratory-calculator:users';
const SESSION_STORAGE_KEY = 'dynamic-laboratory-calculator:session';

const defaultAdmin: AppUser = {
  id: 'admin-default',
  fullName: 'Администратор',
  username: 'admin',
  password: 'admin123',
  role: 'admin',
  createdAt: '2026-01-01T00:00:00.000Z',
};

export interface RegisterSpecialistInput {
  fullName: string;
  username: string;
  password: string;
  laboratoryId: LaboratoryId;
}

export function getUsers(): AppUser[] {
  ensureDefaultAdmin();

  try {
    const rawUsers = window.localStorage.getItem(USERS_STORAGE_KEY);
    if (!rawUsers) {
      return [defaultAdmin];
    }

    const parsed = JSON.parse(rawUsers);
    return Array.isArray(parsed) ? normalizeUsers(parsed) : [defaultAdmin];
  } catch {
    return [defaultAdmin];
  }
}

export function getCurrentUser(): AppUser | null {
  ensureDefaultAdmin();

  try {
    const sessionUserId = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!sessionUserId) {
      return null;
    }

    return getUsers().find((user) => user.id === sessionUserId) ?? null;
  } catch {
    return null;
  }
}

export function loginUser(username: string, password: string): { user: AppUser | null; error?: string } {
  const normalizedUsername = username.trim();
  const user = getUsers().find((item) => item.username === normalizedUsername);

  if (!normalizedUsername || !password) {
    return { user: null, error: 'Введите имя пользователя и пароль.' };
  }

  if (!user || user.password !== password) {
    return { user: null, error: 'Неверное имя пользователя или пароль.' };
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, user.id);
  return { user };
}

export function logoutUser() {
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function registerSpecialist(input: RegisterSpecialistInput): { user: AppUser | null; error?: string } {
  const fullName = input.fullName.trim();
  const username = input.username.trim();
  const password = input.password.trim();
  const laboratory = laboratories.find((item) => item.id === input.laboratoryId);

  if (!fullName || !username || !password || !laboratory) {
    return { user: null, error: 'Заполните все поля регистрации специалиста.' };
  }

  if (password.length < 4) {
    return { user: null, error: 'Пароль должен содержать не менее 4 символов.' };
  }

  const users = getUsers();
  if (users.some((user) => user.username.toLocaleLowerCase('ru-RU') === username.toLocaleLowerCase('ru-RU'))) {
    return { user: null, error: 'Пользователь с таким username уже зарегистрирован.' };
  }

  const user: AppUser = {
    id: crypto.randomUUID(),
    fullName,
    username,
    password,
    role: 'specialist',
    laboratoryId: laboratory.id,
    laboratoryName: laboratory.name,
    createdAt: new Date().toISOString(),
  };

  saveUsers([...users, user]);
  return { user };
}

export function deleteUser(userId: string): { ok: boolean; error?: string } {
  const users = getUsers();
  const user = users.find((item) => item.id === userId);

  if (!user) {
    return { ok: false, error: 'Пользователь не найден.' };
  }

  if (user.role === 'admin') {
    return { ok: false, error: 'Администратора по умолчанию нельзя удалить.' };
  }

  saveUsers(users.filter((item) => item.id !== userId));
  return { ok: true };
}

function ensureDefaultAdmin() {
  try {
    const rawUsers = window.localStorage.getItem(USERS_STORAGE_KEY);
    if (!rawUsers) {
      saveUsers([defaultAdmin]);
      return;
    }

    const parsed = JSON.parse(rawUsers);
    if (!Array.isArray(parsed) || !parsed.some((user) => user.username === defaultAdmin.username)) {
      saveUsers([defaultAdmin, ...(Array.isArray(parsed) ? parsed : [])]);
    }
  } catch {
    saveUsers([defaultAdmin]);
  }
}

function normalizeUsers(users: AppUser[]) {
  const normalized = users.map((user) => ({
    ...user,
    fullName: user.fullName || user.username,
    createdAt: user.createdAt || new Date().toISOString(),
  }));

  if (!normalized.some((user) => user.username === defaultAdmin.username)) {
    return [defaultAdmin, ...normalized];
  }

  return normalized;
}

function saveUsers(users: AppUser[]) {
  window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}
