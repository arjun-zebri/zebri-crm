import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeAll, vi } from 'vitest';

import { Badge } from '@/components/ui-v2/badge';
import { ChipGroup } from '@/components/ui-v2/chip-group';
import { ChoiceCard } from '@/components/ui-v2/choice-card';
import { ColorField } from '@/components/ui-v2/color-field';
import { Dropdown } from '@/components/ui-v2/dropdown';
import { FileDrop } from '@/components/ui-v2/file-drop';
import { Kbd } from '@/components/ui-v2/kbd';
import { Segmented } from '@/components/ui-v2/segmented';
import { Select } from '@/components/ui-v2/select';
import { TagList } from '@/components/ui-v2/tag-list';

// jsdom has no ResizeObserver; Segmented measures its thumb with one.
beforeAll(() => {
  if (!('ResizeObserver' in globalThis))
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
});

function Chips({ multiple }: { multiple?: boolean }) {
  const [v, setV] = useState<string[]>(['MC']);
  return <ChipGroup label="What you do" options={['MC', 'DJ']} value={v} onChange={setV} multiple={multiple ?? false} />;
}

describe('<ChipGroup /> (v2)', () => {

  it('is a labelled group of toggle buttons', () => {
    render(<Chips />);
    expect(screen.getByRole('group', { name: 'What you do' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'MC' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps one pick when single-select', async () => {
    render(<Chips />);
    await userEvent.click(screen.getByRole('button', { name: 'DJ' }));
    expect(screen.getByRole('button', { name: 'DJ' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'MC' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('keeps several when multi-select', async () => {
    render(<Chips multiple />);
    await userEvent.click(screen.getByRole('button', { name: 'DJ' }));
    expect(screen.getByRole('button', { name: 'MC' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'DJ' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('stacked, lists each option with its hint under it and still picks one', async () => {
    const onChange = vi.fn();
    render(<ChipGroup stacked label="Before this marriage" options={['Never married', 'Widowed']} hints={{ Widowed: 'Your partner has died' }} value={[]} onChange={onChange} />);
    const widowed = screen.getByRole('button', { name: /Widowed/ });
    expect(widowed).toHaveTextContent('Your partner has died');
    await userEvent.click(widowed);
    expect(onChange).toHaveBeenCalledWith(['Widowed']);
  });
});

describe('<ChoiceCard /> (v2)', () => {
  it('reports its selection and fires onClick', async () => {
    const onClick = vi.fn();
    render(
      <ChoiceCard selected={false} onClick={onClick}>
        Pro
      </ChoiceCard>,
    );
    const card = screen.getByRole('button', { name: 'Pro' });
    expect(card).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(card);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('draws a check mark only when asked, without changing its name', () => {
    const { container, rerender } = render(
      <ChoiceCard selected check>
        DJ
      </ChoiceCard>,
    );
    expect(screen.getByRole('button', { name: 'DJ' })).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('svg')).toBeInTheDocument();
    rerender(<ChoiceCard selected>DJ</ChoiceCard>);
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });
});

describe('<Badge /> (v2)', () => {
  it('renders its text', () => {
    render(<Badge tone="brand">Popular</Badge>);
    expect(screen.getByText('Popular')).toBeInTheDocument();
  });

  it('matches the control height when it stands in for a button', () => {
    render(<Badge size="control">Soon</Badge>);
    expect(screen.getByText('Soon')).toHaveClass('h-9');
  });
});

describe('<Select /> (v2)', () => {
  it('labels the select and lists the options', () => {
    render(<Select label="Body font" options={['Inter', 'Lora']} defaultValue="Lora" />);
    const select = screen.getByLabelText('Body font');
    expect(select).toHaveValue('Lora');
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });
});

describe('<ColorField /> (v2)', () => {
  it('passes up only complete hex colours', async () => {
    const onChange = vi.fn();
    render(<ColorField label="Primary colour" value="#2f521f" onChange={onChange} />);
    const text = screen.getByLabelText('Primary colour');
    await userEvent.clear(text);
    await userEvent.type(text, '#abc');
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.type(text, 'def');
    expect(onChange).toHaveBeenLastCalledWith('#abcdef');
  });

  it("opens the app's colour picker from the swatch, not the browser's", async () => {
    render(<ColorField label="Primary colour" value="#2f521f" onChange={() => {}} />);
    const swatch = screen.getByRole('button', { name: 'Primary colour picker' });
    expect(swatch).not.toHaveAttribute('type', 'color');
    await userEvent.click(swatch);
    expect(screen.getByPlaceholderText('#000000')).toHaveValue('#2F521F');
  });
});

describe('<FileDrop /> (v2)', () => {
  it('takes a chosen file and shows its name', async () => {
    const onFile = vi.fn();
    render(<FileDrop label="Logo" onFile={onFile} />);
    const file = new File(['x'], 'logo.txt', { type: 'text/plain' });
    await userEvent.upload(screen.getByLabelText('Logo'), file);
    expect(onFile).toHaveBeenCalledWith(file);
    expect(screen.getByText('logo.txt')).toBeInTheDocument();
  });
});

describe('<Kbd /> (v2)', () => {
  it('renders a semantic kbd element', () => {
    render(<Kbd>⏎</Kbd>);
    expect(screen.getByText('⏎').tagName).toBe('KBD');
  });
});

describe('<Segmented /> (v2)', () => {
  it('marks one option pressed and reports a new pick', async () => {
    const onChange = vi.fn();
    render(<Segmented label="Preview" options={['Proposal', 'Invoice']} value="Proposal" onChange={onChange} />);
    expect(screen.getByRole('group', { name: 'Preview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Proposal' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Invoice' })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(screen.getByRole('button', { name: 'Invoice' }));
    expect(onChange).toHaveBeenCalledWith('Invoice');
  });
});

describe('<Dropdown /> (v2)', () => {
  beforeAll(() => {
    // Radix Select reaches for pointer-capture APIs jsdom does not implement.
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.scrollIntoView = () => {};
  });

  const options = [
    { value: 'Fraunces', label: 'Fraunces', fontFamily: '"Fraunces", serif' },
    { value: 'Inter', label: 'Inter' },
  ];

  it('is a labelled combobox showing the pick, and reports a new one from its menu', async () => {
    const onChange = vi.fn();
    render(<Dropdown label="Heading font" options={options} value="Fraunces" onChange={onChange} />);
    const trigger = screen.getByRole('combobox', { name: 'Heading font' });
    expect(trigger).toHaveTextContent('Fraunces');
    await userEvent.click(trigger);
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getAllByRole('option').map((o) => o.textContent)).toEqual(['Fraunces', 'Inter']);
    await userEvent.click(within(listbox).getByRole('option', { name: 'Inter' }));
    expect(onChange).toHaveBeenCalledWith('Inter');
  });

  it('boxed, says Choose while empty and puts its error under the box, in place of the help', () => {
    render(<Dropdown boxed label="State" options={options} value="" onChange={vi.fn()} help="Where you live" error="Needed" />);
    const trigger = screen.getByRole('combobox', { name: 'State' });
    expect(trigger).toHaveTextContent('Choose');
    expect(trigger).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Needed');
    expect(screen.getByText('Where you live')).toHaveClass('sr-only');
  });
});

describe('<TagList /> (v2)', () => {
  it('lists each tag with its own remove button, and the after slot last', async () => {
    const onRemove = vi.fn();
    render(<TagList label="What it includes" items={['Rehearsal', 'PA and mic']} onRemove={onRemove} after={<span>Add an inclusion</span>} />);
    const list = screen.getByRole('list', { name: 'What it includes' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(within(list).getAllByRole('listitem').at(-1)).toHaveTextContent('Add an inclusion');
    await userEvent.click(screen.getByRole('button', { name: 'Remove PA and mic' }));
    // The tag fades where it stands first, then leaves.
    await waitFor(() => expect(onRemove).toHaveBeenCalledWith('PA and mic'));
  });
});

describe('selected and disabled (v2, 2026-10-14)', () => {
  it('marks a picked chip with the selected token, and a disabled group cannot be changed', async () => {
    const onChange = vi.fn();
    render(<ChipGroup label="Role" options={['MC', 'DJ']} value={['MC']} onChange={onChange} disabled />);
    const mc = screen.getByRole('button', { name: 'MC' });
    expect(mc.className).toContain('border-selected');
    expect(mc).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'DJ' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('disables every Segmented option and names icon-only options without a native title', () => {
    const Icon = () => <svg />;
    render(<Segmented label="Corners" options={['round', 'square']} icons={{ round: Icon, square: Icon }} iconsOnly value="round" onChange={() => {}} disabled />);
    for (const name of ['round', 'square']) {
      const option = screen.getByRole('button', { name });
      expect(option).toBeDisabled();
      expect(option).not.toHaveAttribute('title');
      expect(option.querySelector('[data-tip]')).toHaveTextContent(name);
    }
  });

  it('draws a picked ChoiceCard with the selected edge', () => {
    render(<ChoiceCard selected>Pro</ChoiceCard>);
    expect(screen.getByRole('button', { name: 'Pro' }).className).toContain('border-selected');
  });
});
