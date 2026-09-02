/**
 * Characters offered by the script toolbar's insert-character menu, for
 * names and words the writer's keyboard cannot type directly. Lowercase
 * precomposed (NFC) letters; the menu upper-cases on demand.
 *
 * No React here.
 *
 * @module lib/documents/script-characters
 */
export const SCRIPT_CHARACTER_GROUPS: readonly { label: string; chars: string }[] = [
  { label: 'Vietnamese', chars: 'àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ' },
  { label: 'Latin accents', chars: 'àáâäãåæçèéêëìíîïñòóôöõøœùúûüýÿßłńśźżćęąğşıčšžřďťňő' },
  { label: 'Māori and Pacific', chars: 'āēīōūʻ' },
  { label: 'Greek', chars: 'αβγδεζηθικλμνξοπρστυφχψωάέήίόύώ' },
]
