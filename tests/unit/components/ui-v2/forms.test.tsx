import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { Checkbox } from '@/components/ui-v2/checkbox';
import { InlineInput } from '@/components/ui-v2/inline-input';
import { Input } from '@/components/ui-v2/input';
import { PasswordInput } from '@/components/ui-v2/password-input';
import { Select } from '@/components/ui-v2/select';
import { TextLink } from '@/components/ui-v2/text-link';
import { Textarea } from '@/components/ui-v2/textarea';

describe('<Input /> (v2)', () => {
  it('labels the input', () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText('Email').tagName).toBe('INPUT');
  });

  it('describes the input with its help text', () => {
    render(<Input label="Business name" help="Shown on proposals." />);
    expect(screen.getByLabelText('Business name')).toHaveAccessibleDescription('Shown on proposals.');
  });

  it('marks the input invalid and announces the error, keeping the help', () => {
    render(<Input label="Email" help="Work email is best." error="Enter a valid email address." />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Work email is best. Enter a valid email address.');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.');
    // Under the quiet-name rule (2026-10-14) help and error both sit under the control.
    const help = screen.getByText('Work email is best.');
    expect(input.compareDocumentPosition(help) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(help.compareDocumentPosition(screen.getByRole('alert')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('leads a form field with its decorative icon; a raised search pads past it', () => {
    render(
      <>
        <Input label="Email" leading={<svg data-testid="icon" />} />
        <Input label="Search" raised leading={<svg />} />
      </>,
    );
    expect(screen.getByTestId('icon').parentElement).toHaveAttribute('aria-hidden', 'true');
    // Raised, the icon sits inside the box's padding.
    expect(screen.getByLabelText('Search').className).toContain('pl-9');
  });

  it('is a fitted field: named by its placeholder, as wide as its words, tinted on hover only', () => {
    function Glyph(props: { className?: string }) {
      return <svg data-testid="glyph" {...props} />;
    }
    render(<Input icon={Glyph} label="Website" />);
    const field = screen.getByLabelText('Website');
    expect(field).toHaveAttribute('placeholder', 'Website');
    // size 1 drops the browser's minimum width, so the hidden copy of the words sets it.
    expect(field).toHaveAttribute('size', '1');
    expect(field.parentElement?.className).toContain('[&:hover:not(:focus-within):not([data-state=open])]:bg-hover');
    expect(screen.getByTestId('glyph')).toHaveClass('text-zebra-400');
  });

  it('renders content beside the label', () => {
    render(<Input label="Password" labelAside={<a href="#x">Forgot?</a>} />);
    expect(screen.getByRole('link', { name: 'Forgot?' })).toBeInTheDocument();
  });
});

describe('<PasswordInput /> (v2)', () => {
  it('hides the password until the toggle is pressed', async () => {
    render(<PasswordInput label="Password" />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('<Textarea /> (v2)', () => {
  it('labels the textarea and carries the error', () => {
    render(<Textarea label="Notes" error="Too long." />);
    expect(screen.getByLabelText('Notes')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('<Checkbox /> (v2)', () => {
  it('toggles when its label is clicked', async () => {
    render(<Checkbox label="Send me a copy" />);
    const box = screen.getByRole('checkbox', { name: 'Send me a copy' });
    await userEvent.click(screen.getByText('Send me a copy'));
    expect(box).toBeChecked();
  });
});

describe('<TextLink /> (v2)', () => {
  it('is a button when it has no href', async () => {
    const onClick = vi.fn();
    render(<TextLink onClick={onClick}>14 more</TextLink>);
    const button = screen.getByRole('button', { name: '14 more' });
    expect(button).toHaveAttribute('type', 'button');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders a link to its href', () => {
    render(<TextLink href="/signup">Create an account</TextLink>);
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/signup');
  });

  it('is underlined, and its width-holding copy is hidden from assistive tech', () => {
    render(<TextLink href="/signup">Create an account</TextLink>);
    const link = screen.getByRole('link', { name: 'Create an account' });
    expect(link.className).toContain('underline');
    expect(link.querySelector('[aria-hidden="true"]')).toHaveTextContent('Create an account');
  });
});

describe('<InlineInput /> (v2)', () => {
  it('is named by its aria-label and takes typing', async () => {
    render(<InlineInput aria-label="Package name" placeholder="Package name" />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Package name' }), 'Ceremony only');
    expect(screen.getByRole('textbox', { name: 'Package name' })).toHaveValue('Ceremony only');
  });

  it('draws no line of its own; only `underline` adds one', () => {
    render(
      <>
        <InlineInput aria-label="Plain" />
        <InlineInput aria-label="Underlined" underline />
      </>,
    );
    expect(screen.getByLabelText('Plain')).not.toHaveClass('border-b');
    expect(screen.getByLabelText('Underlined')).toHaveClass('border-zebra-950');
  });

  it('puts a suffix inside the underline, hidden from the accessible name', () => {
    render(<InlineInput aria-label="Deposit percent" underline suffix="%" defaultValue="25" />);
    const input = screen.getByRole('textbox', { name: 'Deposit percent' });
    expect(input.parentElement).toHaveClass('border-zebra-950');
    expect(input.parentElement).toHaveTextContent('%');
  });
});

describe('<Select /> (v2)', () => {
  it('is boxless by default and a grey well when filled', () => {
    render(
      <>
        <Select label="Plain" options={['A']} />
        <Select label="Filled" options={['A']} filled />
      </>,
    );
    expect(screen.getByLabelText('Plain')).toHaveClass('bg-transparent');
    expect(screen.getByLabelText('Filled')).toHaveClass('bg-hover');
  });
});
