import { cva, type VariantProps } from 'class-variance-authority';

export const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        primary: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 focus-visible:ring-blue-500',
        outline: 'border border-gray-300 bg-transparent hover:bg-gray-50 active:bg-gray-100 text-gray-700 focus-visible:ring-gray-500',
        ghost: 'bg-transparent hover:bg-gray-100 active:bg-gray-200 text-gray-700 focus-visible:ring-gray-500',
        danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-500',
        link: 'bg-transparent underline-offset-4 hover:underline text-blue-600 focus-visible:ring-blue-500',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 py-2',
        lg: 'h-12 px-8 text-base',
      },
      weight: {
        normal: 'font-normal',
        medium: 'font-medium',
        bold: 'font-bold',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      weight: 'medium',
    },
  }
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;
