import { z } from 'zod';

export const registerSchema = z
  .object({
    phone: z
      .string()
      .regex(/^\+?[0-9]{7,15}$/, 'Invalid phone number')
      .optional(),
    email: z.string().email().optional(),
    password: z.string().min(8, 'Password must be at least 8 characters').max(100),
    fullName: z.string().min(1).max(120).optional(),
  })
  .refine((value) => value.phone || value.email, {
    message: 'Provide a phone number or an email',
    path: ['identifier'],
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const verifySchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
});
export type VerifyInput = z.infer<typeof verifySchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const logoutSchema = refreshSchema;
export type LogoutInput = RefreshInput;