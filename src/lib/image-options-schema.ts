import { z } from 'zod';

export const ImageConfigSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  cardName: z.string().min(1, 'Card name is required.'),
  placeholder: z.string().min(1, 'Placeholder is required.'),
  width: z.coerce.number().positive('Width must be a positive number.'),
  height: z.coerce.number().positive('Height must be a positive number.'),
});

export const ImageOptionsSchema = z.array(ImageConfigSchema);

export type ImageConfig = z.infer<typeof ImageConfigSchema>;
export type ImageOptionsData = z.infer<typeof ImageOptionsSchema>;
