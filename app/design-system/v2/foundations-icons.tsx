import { ArrowForwardIcon, ArrowLeftIcon, ArrowRightIcon, AttachIcon, BdmIcon, BlocksIcon, BrandSearchIcon, CalendarIcon, CeremonyScriptIcon, ClientsIcon, ConnectIcon, CopyLinkIcon, DiscoverIcon, DocumentsIcon, EnquiriesIcon, HomeIcon, MicIcon, NotificationsIcon, PaymentsIcon, PlusIcon, ProposalIcon, RunSheetIcon, SettingsIcon, SetupIcon, OverviewIcon, SentIcon, TemplatesIcon, ClockIcon, CloseIcon, ContractIcon, DragIcon, EditIcon, EmailIcon, InvoiceIcon, QuestionnaireIcon, StartIcon, TaskIcon, WeddingDayIcon, JourneysIcon, CallIcon, NotesIcon, VenueIcon, GuestsIcon, ActivityIcon, PackageIcon, SourceIcon, TextSectionIcon, PhotosIcon, VideoIcon, ReviewsIcon, CommonQuestionsIcon, AcceptIcon, NewPageIcon, HeaderSectionIcon, CornerSquareIcon, CornerSoftIcon, CornerRoundIcon, ButtonFilledIcon, ButtonOutlineIcon, AlertIcon, AlignTopIcon, AlignMiddleIcon, AlignBottomIcon, AlignLeftEdgeIcon, AlignCentreEdgeIcon, AlignRightEdgeIcon, AlignLeftIcon, AlignCenterIcon, AlignRightIcon, ArchiveIcon, ArrowUpIcon, ArrowDownIcon, BranchIcon, BriefcaseIcon, BringToFrontIcon, BrushIcon, BuildingIcon, CalendarCheckIcon, CalendarClockIcon, CalendarRangeIcon, CalendarSyncIcon, CaseSensitiveIcon, CaseUpperIcon, ChatIcon, CheckIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon, CircleCheckIcon, CircleCloseIcon, CircleDotIcon, CodeIcon, CoffeeIcon, CollapseIcon, CropIcon, DesktopIcon, DownloadIcon, ExpandIcon, EyeOffIcon, EyeIcon, FileCheckIcon, FileEditIcon, FilePlusIcon, FillIcon, FilterIcon, FlagIcon, GalleryIcon, GlobeIcon, HeadingIcon, Heading2Icon, Heading3Icon, HeartIcon, HourglassIcon, ImagePlusIcon, ImageUpIcon, ImageIcon, ImportIcon, InfoIcon, FacebookIcon, InstagramIcon, LabIcon, LinkedinIcon, LandmarkIcon, LayersIcon, LayoutGridIcon, LayoutPanelTopIcon, LayoutTemplateIcon, LinkIcon, ListIcon, ListOrderedIcon, ListChecksIcon, LockIcon, MagicIcon, MaximizeIcon, MenuIcon, MessageTextIcon, MessageIcon, MicOffIcon, MinusIcon, MobileIcon, MoreIcon, MoveHorizontalIcon, MoveVerticalIcon, MusicIcon, PaletteIcon, PanelTopIcon, PauseIcon, PlayCircleIcon, PlayIcon, PrinterIcon, QuoteIcon, RadiusIcon, ReceiptIcon, RectangleIcon, RedoIcon, ResetIcon, RowsIcon, SearchIcon, SendToBackIcon, ShapesIcon, SlidersIcon, SparklesIcon, SpinnerIcon, SquareIcon, StarIcon, StoreIcon, BoldIcon, ItalicIcon, UnderlineIcon, StrikethroughIcon, TabletIcon, TextIcon, TrashIcon, TypeIcon, UndoIcon, UploadIcon, UserPlusIcon, UserIcon, VideoOffIcon, ZapIcon, IdCardIcon, FamilyTreeIcon, RingsIcon, MaxPlanIcon, AccountManagerIcon, VoteIcon, type IconTier, type ZebriIcon } from '@/components/ui-v2/icons';

import { Spec } from './showroom-v2';

/**
 * v2 icon foundations: every Zebri icon, grouped by tier, at the sizes
 * it is used at, on light and on ink. Since 2026-10-14 every icon in v2
 * is a Zebri drawing (user ruling); Lucide is no longer used.
 *
 * The `/new-icon` skill adds an entry to {@link ICONS} for every icon it
 * makes, and previews drafts here before they are approved.
 *
 * @module app/design-system/v2/foundations-icons
 */

/** One registered icon: the component, its tier, and the brief it was drawn from. */
type IconEntry = { name: string; icon: ZebriIcon; tier: IconTier; brief: string };

/** Every Zebri icon, in the order they were added. `/new-icon` appends here. */
const ICONS: IconEntry[] = [
  { name: 'BdmIcon', icon: BdmIcon, tier: 'glyph', brief: 'A page with a title line over a ticked circle: marriage paperwork, lodged with BDM.' },
  { name: 'RunSheetIcon', icon: RunSheetIcon, tier: 'glyph', brief: 'A clipboard of numbered rows, 1 and 2: the run sheet document.' },
  { name: 'CeremonyScriptIcon', icon: CeremonyScriptIcon, tier: 'glyph', brief: 'A page with a title line over two interlocked rings: the ceremony script.' },
  { name: 'HomeIcon', icon: HomeIcon, tier: 'glyph', brief: 'An arched doorway silhouette with an arched door: the Home page.' },
  { name: 'ClientsIcon', icon: ClientsIcon, tier: 'glyph', brief: 'Two arched figures side by side, the Home arch as people: the Clients page.' },
  { name: 'DocumentsIcon', icon: DocumentsIcon, tier: 'glyph', brief: 'A soft page with a title line over three lines: the Documents tab.' },
  { name: 'BlocksIcon', icon: BlocksIcon, tier: 'glyph', brief: 'Three soft tiles and a plus in the fourth place: the Blocks catalogue.' },
  { name: 'PaymentsIcon', icon: PaymentsIcon, tier: 'glyph', brief: 'A soft card, its number as three dots then the last digits: the Payments page.' },
  { name: 'CalendarIcon', icon: CalendarIcon, tier: 'glyph', brief: 'A soft page with two rings, a header and day dots: the Calendar.' },
  { name: 'EnquiriesIcon', icon: EnquiriesIcon, tier: 'glyph', brief: 'A soft speech bubble with three dots, someone asking: Enquiries.' },
  { name: 'NotificationsIcon', icon: NotificationsIcon, tier: 'glyph', brief: 'A short, wide, round bell with an arc clapper: notifications.' },
  { name: 'SettingsIcon', icon: SettingsIcon, tier: 'glyph', brief: 'A cog with six broad straight teeth and round tips: Settings.' },
  { name: 'ProposalIcon', icon: ProposalIcon, tier: 'glyph', brief: 'A soft page, a title over two package options: Proposals.' },
  { name: 'MicIcon', icon: MicIcon, tier: 'glyph', brief: 'A soft capsule on a stand and base: voice input.' },
  { name: 'DiscoverIcon', icon: DiscoverIcon, tier: 'glyph', brief: 'A soft gift, a feature not unwrapped yet: Discover Zebri.' },
  { name: 'AttachIcon', icon: AttachIcon, tier: 'glyph', brief: 'A soft two-loop paperclip, tilted 45 degrees: attach a file.' },
  { name: 'ArrowLeftIcon', icon: ArrowLeftIcon, tier: 'glyph', brief: 'A soft open chevron: back, previous, collapse.' },
  { name: 'ArrowRightIcon', icon: ArrowRightIcon, tier: 'glyph', brief: 'A soft open chevron: next, open, go on.' },
  { name: 'ArrowForwardIcon', icon: ArrowForwardIcon, tier: 'glyph', brief: 'A true arrow, shaft and head: a call to action\'s go (Get early access).' },
  { name: 'PlusIcon', icon: PlusIcon, tier: 'glyph', brief: 'A long plain plus: add.' },
  { name: 'CopyLinkIcon', icon: CopyLinkIcon, tier: 'glyph', brief: 'Two soft squares, one behind the other: copy a link, duplicate.' },
  { name: 'SetupIcon', icon: SetupIcon, tier: 'glyph', brief: 'A sprout, two soft leaves on a stem: getting set up.' },
  { name: 'TemplatesIcon', icon: TemplatesIcon, tier: 'glyph', brief: 'Two soft pages, one behind the other, a title line on the front: Templates.' },
  { name: 'SentIcon', icon: SentIcon, tier: 'glyph', brief: 'A soft paper plane with rounded points and a fold line: Sent.' },
  { name: 'OverviewIcon', icon: OverviewIcon, tier: 'glyph', brief: 'A soft frame with a small line chart rising inside: Overview.' },
  { name: 'ConnectIcon', icon: ConnectIcon, tier: 'glyph', brief: 'A rounded plug, a soft cup under two prongs, with its cord: connect an account.' },
  { name: 'ClockIcon', icon: ClockIcon, tier: 'glyph', brief: 'A round face with two hands: when something happens.' },
  { name: 'CloseIcon', icon: CloseIcon, tier: 'glyph', brief: 'A plain cross: close, remove.' },
  { name: 'ContractIcon', icon: ContractIcon, tier: 'glyph', brief: 'A soft page, a title, a signature squiggle on its line: Contracts.' },
  { name: 'DragIcon', icon: DragIcon, tier: 'glyph', brief: 'Two columns of three dots: a drag handle.' },
  { name: 'EditIcon', icon: EditIcon, tier: 'glyph', brief: 'A soft pencil with a round end and a ferrule line: edit.' },
  { name: 'EmailIcon', icon: EmailIcon, tier: 'glyph', brief: 'A soft envelope, its flap corner to corner: an email.' },
  { name: 'InvoiceIcon', icon: InvoiceIcon, tier: 'glyph', brief: 'A soft page, a short title, two items with dot amounts and a total: Invoices.' },
  { name: 'QuestionnaireIcon', icon: QuestionnaireIcon, tier: 'glyph', brief: 'The run sheet clipboard with a question mark: Questionnaires.' },
  { name: 'StartIcon', icon: StartIcon, tier: 'glyph', brief: 'A straight arrow pointing right: start something off.' },
  { name: 'TaskIcon', icon: TaskIcon, tier: 'glyph', brief: 'A soft square with a tick: a to-do for the MC.' },
  { name: 'WeddingDayIcon', icon: WeddingDayIcon, tier: 'glyph', brief: 'A soft heart with a round point: the wedding day marker.' },
  { name: 'JourneysIcon', icon: JourneysIcon, tier: 'glyph', brief: 'A ring, one soft S and a heart where it lands: Journeys.' },
  { name: 'BrandSearchIcon', icon: BrandSearchIcon, tier: 'glyph', brief: 'A globe with a small soft spark: looking up the MC\'s brand on their website.' },
  { name: 'ActivityIcon', icon: ActivityIcon, tier: 'glyph', brief: "A soft frame with a pulse line through it: Activity, everything happening with a client." },
  { name: 'CallIcon', icon: CallIcon, tier: 'glyph', brief: "A soft video camera, body and lens: a video call with a client." },
  { name: 'NotesIcon', icon: NotesIcon, tier: 'glyph', brief: "A pencil writing on a line: the MC's own notes." },
  { name: 'VenueIcon', icon: VenueIcon, tier: 'glyph', brief: "A soft map pin with a round centre: where the event is held." },
  { name: 'GuestsIcon', icon: GuestsIcon, tier: 'glyph', brief: "A crowd, one figure in front and two smaller behind: how many guests are coming." },
  { name: 'PackageIcon', icon: PackageIcon, tier: 'glyph', brief: 'A soft cube, a box seen from above: the package a client chose.' },
  { name: 'TextSectionIcon', icon: TextSectionIcon, tier: 'glyph', brief: 'A soft square holding a capital T: a text section in a document.' },
  { name: 'PhotosIcon', icon: PhotosIcon, tier: 'glyph', brief: 'A soft frame with a sun dot over two hills: a photo gallery.' },
  { name: 'VideoIcon', icon: VideoIcon, tier: 'glyph', brief: 'A soft screen with a play triangle: a video.' },
  { name: 'ReviewsIcon', icon: ReviewsIcon, tier: 'glyph', brief: 'A speech bubble holding two lines of words: what past clients said.' },
  { name: 'CornerSquareIcon', icon: CornerSquareIcon, tier: 'glyph', brief: 'A wide outline with square corners: the brand kit\'s Square corners.' },
  { name: 'CornerSoftIcon', icon: CornerSoftIcon, tier: 'glyph', brief: 'A wide outline with soft corners: the brand kit\'s Soft corners.' },
  { name: 'CornerRoundIcon', icon: CornerRoundIcon, tier: 'glyph', brief: 'A wide outline with round ends: the brand kit\'s Round corners.' },
  { name: 'ButtonFilledIcon', icon: ButtonFilledIcon, tier: 'glyph', brief: 'A solid button: the brand kit\'s Filled buttons.' },
  { name: 'ButtonOutlineIcon', icon: ButtonOutlineIcon, tier: 'glyph', brief: 'An outlined button: the brand kit\'s Outline buttons.' },
  { name: 'CommonQuestionsIcon', icon: CommonQuestionsIcon, tier: 'glyph', brief: 'A soft square holding a question mark: the questions every client asks.' },
  { name: 'InfoIcon', icon: InfoIcon, tier: 'glyph', brief: 'An i in a circle: a field\'s note, kept behind a tooltip.' },
  { name: 'AcceptIcon', icon: AcceptIcon, tier: 'glyph', brief: 'A soft square holding a tick: where a client says yes.' },
  { name: 'NewPageIcon', icon: NewPageIcon, tier: 'glyph', brief: 'The foot of one page and the head of the next, a dashed cut between: a new page.' },
  { name: 'HeaderSectionIcon', icon: HeaderSectionIcon, tier: 'glyph', brief: 'A page with a band across its top holding a logo dot and a name: the Header section.' },
  { name: 'SourceIcon', icon: SourceIcon, tier: 'glyph', brief: 'A soft magnet, what draws clients in: where a client found the MC.' },
  // 2026-10-14: the Lucide replacements, so every icon in v2 is a Zebri drawing.
  { name: 'AlertIcon', icon: AlertIcon, tier: 'glyph', brief: 'A round face with an exclamation mark. For warnings and errors.' },
  { name: 'AlignTopIcon', icon: AlignTopIcon, tier: 'glyph', brief: 'Bars hanging from a top axis.' },
  { name: 'AlignMiddleIcon', icon: AlignMiddleIcon, tier: 'glyph', brief: 'Bars centred on a horizontal axis.' },
  { name: 'AlignBottomIcon', icon: AlignBottomIcon, tier: 'glyph', brief: 'Bars standing on a bottom axis.' },
  { name: 'AlignLeftEdgeIcon', icon: AlignLeftEdgeIcon, tier: 'glyph', brief: 'Bars against a left axis.' },
  { name: 'AlignCentreEdgeIcon', icon: AlignCentreEdgeIcon, tier: 'glyph', brief: 'Bars centred on a vertical axis.' },
  { name: 'AlignRightEdgeIcon', icon: AlignRightEdgeIcon, tier: 'glyph', brief: 'Bars against a right axis.' },
  { name: 'AlignLeftIcon', icon: AlignLeftIcon, tier: 'glyph', brief: 'Text aligned left.' },
  { name: 'AlignCenterIcon', icon: AlignCenterIcon, tier: 'glyph', brief: 'Text centred.' },
  { name: 'AlignRightIcon', icon: AlignRightIcon, tier: 'glyph', brief: 'Text aligned right.' },
  { name: 'ArchiveIcon', icon: ArchiveIcon, tier: 'glyph', brief: 'A soft box under a lid, with a handle slot. For archiving.' },
  { name: 'ArrowUpIcon', icon: ArrowUpIcon, tier: 'glyph', brief: 'Arrow glyphs (vertical): soft open chevrons, up and down, drawn as the vertical pair of ArrowLeftIcon and ArrowRightIcon. For moving something up or down and sort direction.' },
  { name: 'ArrowDownIcon', icon: ArrowDownIcon, tier: 'glyph', brief: 'Arrow glyphs (vertical): soft open chevrons, up and down, drawn as the vertical pair of ArrowLeftIcon and ArrowRightIcon. For moving something up or down and sort direction.' },
  { name: 'BranchIcon', icon: BranchIcon, tier: 'glyph', brief: 'A step node whose path splits into two ends. For a journey branch.' },
  { name: 'BriefcaseIcon', icon: BriefcaseIcon, tier: 'glyph', brief: 'A soft case with an arched handle and a band. For work, business or a role.' },
  { name: 'BringToFrontIcon', icon: BringToFrontIcon, tier: 'glyph', brief: 'A whole square in front of two half-hidden ones. For bring to front.' },
  { name: 'BrushIcon', icon: BrushIcon, tier: 'glyph', brief: 'A slanted handle with a soft end and a rounded tuft of bristles. For brush or style tools.' },
  { name: 'BuildingIcon', icon: BuildingIcon, tier: 'glyph', brief: 'A soft tower with a lower wing, windows as dots and a small door. For a company or organisation.' },
  { name: 'CalendarCheckIcon', icon: CalendarCheckIcon, tier: 'glyph', brief: 'Calendar variant glyphs: the Calendar frame exactly, plus one small detail in the body. CalendarCheck: a check in the body. For a confirmed date. CalendarClock: a small clock in the body. For a scheduled time. CalendarRange: a dot and bar over a bar and dot. For a date range. CalendarSync: two opposing arrows in the body. For a synced calendar.' },
  { name: 'CalendarClockIcon', icon: CalendarClockIcon, tier: 'glyph', brief: 'Calendar variant glyphs: the Calendar frame exactly, plus one small detail in the body. CalendarCheck: a check in the body. For a confirmed date. CalendarClock: a small clock in the body. For a scheduled time. CalendarRange: a dot and bar over a bar and dot. For a date range. CalendarSync: two opposing arrows in the body. For a synced calendar.' },
  { name: 'CalendarRangeIcon', icon: CalendarRangeIcon, tier: 'glyph', brief: 'Calendar variant glyphs: the Calendar frame exactly, plus one small detail in the body. CalendarCheck: a check in the body. For a confirmed date. CalendarClock: a small clock in the body. For a scheduled time. CalendarRange: a dot and bar over a bar and dot. For a date range. CalendarSync: two opposing arrows in the body. For a synced calendar.' },
  { name: 'CalendarSyncIcon', icon: CalendarSyncIcon, tier: 'glyph', brief: 'Calendar variant glyphs: the Calendar frame exactly, plus one small detail in the body. CalendarCheck: a check in the body. For a confirmed date. CalendarClock: a small clock in the body. For a scheduled time. CalendarRange: a dot and bar over a bar and dot. For a date range. CalendarSync: two opposing arrows in the body. For a synced calendar.' },
  { name: 'CaseSensitiveIcon', icon: CaseSensitiveIcon, tier: 'glyph', brief: 'An upper and a lower case A (Aa). For match case or letter case.' },
  { name: 'CaseUpperIcon', icon: CaseUpperIcon, tier: 'glyph', brief: 'Two capital As (AA). For upper case.' },
  { name: 'ChatIcon', icon: ChatIcon, tier: 'glyph', brief: 'A round speech bubble with a tail at the bottom left. For a conversation or chat. Tail points are computed on the circle (2 decimals).' },
  { name: 'CheckIcon', icon: CheckIcon, tier: 'glyph', brief: 'A plain tick, the same weight and span as PlusIcon. For done, selected and confirmed.' },
  { name: 'ChevronDownIcon', icon: ChevronDownIcon, tier: 'glyph', brief: 'Chevron glyphs: small open chevrons in four directions, lighter than the Arrow glyphs. For dropdowns, disclosure rows and steppers.' },
  { name: 'ChevronLeftIcon', icon: ChevronLeftIcon, tier: 'glyph', brief: 'Chevron glyphs: small open chevrons in four directions, lighter than the Arrow glyphs. For dropdowns, disclosure rows and steppers.' },
  { name: 'ChevronRightIcon', icon: ChevronRightIcon, tier: 'glyph', brief: 'Chevron glyphs: small open chevrons in four directions, lighter than the Arrow glyphs. For dropdowns, disclosure rows and steppers.' },
  { name: 'ChevronUpIcon', icon: ChevronUpIcon, tier: 'glyph', brief: 'Chevron glyphs: small open chevrons in four directions, lighter than the Arrow glyphs. For dropdowns, disclosure rows and steppers.' },
  { name: 'CircleCheckIcon', icon: CircleCheckIcon, tier: 'glyph', brief: 'A tick in a circle. For complete and success states.' },
  { name: 'CircleCloseIcon', icon: CircleCloseIcon, tier: 'glyph', brief: 'A cross in a circle. For failed, cancelled and clearing a value.' },
  { name: 'CircleDotIcon', icon: CircleDotIcon, tier: 'glyph', brief: 'A small solid dot in a circle. For a selected option or an active status.' },
  { name: 'CodeIcon', icon: CodeIcon, tier: 'glyph', brief: 'A pair of angle brackets. For code or embed.' },
  { name: 'CoffeeIcon', icon: CoffeeIcon, tier: 'glyph', brief: 'A soft mug with a round handle and three steam lines. For a break, a meeting or a cafe.' },
  { name: 'CollapseIcon', icon: CollapseIcon, tier: 'glyph', brief: 'Two chevrons pointing in to the middle. For collapsing expanded rows or sections.' },
  { name: 'CropIcon', icon: CropIcon, tier: 'glyph', brief: 'Two soft corner brackets crossing, the classic crop marks. For cropping an image.' },
  { name: 'DesktopIcon', icon: DesktopIcon, tier: 'glyph', brief: 'A soft screen on a short stand and base. For the desktop preview.' },
  { name: 'DownloadIcon', icon: DownloadIcon, tier: 'glyph', brief: 'An arrow down into a soft tray. For downloading or exporting a file.' },
  { name: 'ExpandIcon', icon: ExpandIcon, tier: 'glyph', brief: 'Two arrows pointing out from a dashed middle line. For expanding collapsed rows or sections.' },
  { name: 'EyeOffIcon', icon: EyeOffIcon, tier: 'glyph', brief: 'The EyeIcon crossed by a slash. For hide and hidden.' },
  { name: 'EyeIcon', icon: EyeIcon, tier: 'glyph', brief: 'An almond eye with a round iris. For show, preview and visible.' },
  { name: 'FileCheckIcon', icon: FileCheckIcon, tier: 'glyph', brief: 'The Documents soft rect with a check. For an approved, signed or complete file.' },
  { name: 'IdCardIcon', icon: IdCardIcon, tier: 'glyph', brief: 'A landscape card with a portrait and two lines. For the ID someone shows.' },
  { name: 'FamilyTreeIcon', icon: FamilyTreeIcon, tier: 'glyph', brief: 'Two heads joined, a line down to a third. For someone\'s parents.' },
  { name: 'RingsIcon', icon: RingsIcon, tier: 'glyph', brief: 'Two linked rings. For a marriage, such as an earlier one.' },
  { name: 'FileEditIcon', icon: FileEditIcon, tier: 'glyph', brief: 'The Documents soft rect with a small pencil. For editing a file.' },
  { name: 'FilePlusIcon', icon: FilePlusIcon, tier: 'glyph', brief: 'The Documents soft rect with a plus. For adding or creating a file.' },
  { name: 'FillIcon', icon: FillIcon, tier: 'glyph', brief: 'A tipped paint bucket with its handle and a drop falling from the lip. For fill colour.' },
  { name: 'FilterIcon', icon: FilterIcon, tier: 'glyph', brief: 'Three lines narrowing toward the bottom. For filtering a list.' },
  { name: 'FlagIcon', icon: FlagIcon, tier: 'glyph', brief: 'A wavy flag on a pole. For flagging, marking and milestones.' },
  { name: 'GalleryIcon', icon: GalleryIcon, tier: 'glyph', brief: 'A soft card in front with the edges of its neighbours at either side. For a horizontal gallery or carousel.' },
  { name: 'GlobeIcon', icon: GlobeIcon, tier: 'glyph', brief: 'A circle with a meridian ellipse and an equator. For a website, language or worldwide.' },
  { name: 'HeadingIcon', icon: HeadingIcon, tier: 'glyph', brief: 'A plain H.' },
  { name: 'Heading2Icon', icon: Heading2Icon, tier: 'glyph', brief: 'A small H with a 2.' },
  { name: 'Heading3Icon', icon: Heading3Icon, tier: 'glyph', brief: 'A small H with a 3.' },
  { name: 'HeartIcon', icon: HeartIcon, tier: 'glyph', brief: 'A soft heart. For likes, favourites and the couple.' },
  { name: 'HourglassIcon', icon: HourglassIcon, tier: 'glyph', brief: 'Two soft bulbs meeting at a waist, capped top and bottom. For waiting, pending and time running.' },
  { name: 'ImagePlusIcon', icon: ImagePlusIcon, tier: 'glyph', brief: 'The Image frame opened at its top-right corner for a small plus. For adding an image.' },
  { name: 'ImageUpIcon', icon: ImageUpIcon, tier: 'glyph', brief: 'The Image frame opened at its top-right corner for an up arrow. For uploading an image.' },
  { name: 'ImageIcon', icon: ImageIcon, tier: 'glyph', brief: 'A soft frame with a sun dot over rolling hills. One picture; the single-image partner of Photos.' },
  { name: 'ImportIcon', icon: ImportIcon, tier: 'glyph', brief: 'An arrow down into an open soft box. For importing data.' },
  { name: 'FacebookIcon', icon: FacebookIcon, tier: 'glyph', brief: 'A soft rounded square with the lowercase f running off its foot. For a Facebook link or page; drawn to sit beside Instagram.' },
  { name: 'InstagramIcon', icon: InstagramIcon, tier: 'glyph', brief: 'A soft rounded square camera with a round lens and a dot. For an Instagram link or handle.' },
  { name: 'LabIcon', icon: LabIcon, tier: 'glyph', brief: 'A conical flask with a lip and a liquid line. For experiments, tests or beta features. Bottom corners are softened with short quadratic curves (2 decimals).' },
  { name: 'LinkedinIcon', icon: LinkedinIcon, tier: 'glyph', brief: 'A soft rounded square holding a short i beside an n with a rounded shoulder. For a LinkedIn link or page.' },
  { name: 'LandmarkIcon', icon: LandmarkIcon, tier: 'glyph', brief: 'A pediment roof over four columns on a base. For an institution, bank or civic venue.' },
  { name: 'LayersIcon', icon: LayersIcon, tier: 'glyph', brief: 'A diamond with two layers under it. For layers.' },
  { name: 'LayoutGridIcon', icon: LayoutGridIcon, tier: 'glyph', brief: 'Four small soft squares in a grid. For a grid layout.' },
  { name: 'LayoutPanelTopIcon', icon: LayoutPanelTopIcon, tier: 'glyph', brief: 'A wide panel over two small squares. For a layout with a top panel.' },
  { name: 'LayoutTemplateIcon', icon: LayoutTemplateIcon, tier: 'glyph', brief: 'A wide panel over a broad block and a narrow one. For a page layout or template.' },
  { name: 'LinkIcon', icon: LinkIcon, tier: 'glyph', brief: 'A chain link: two open loops joined by a bar. For a hyperlink (not CopyLink, which is two squares).' },
  { name: 'ListIcon', icon: ListIcon, tier: 'glyph', brief: 'Three rows with dot markers.' },
  { name: 'ListOrderedIcon', icon: ListOrderedIcon, tier: 'glyph', brief: 'Three rows numbered 1 and 2, as Lucide draws it.' },
  { name: 'ListChecksIcon', icon: ListChecksIcon, tier: 'glyph', brief: 'Three rows, the first and last ticked.' },
  { name: 'LockIcon', icon: LockIcon, tier: 'glyph', brief: 'A soft padlock body under an arched shackle, with a keyhole. For locked, private and secure.' },
  { name: 'MagicIcon', icon: MagicIcon, tier: 'glyph', brief: 'A wand with a band near its tip and two small sparkles. For generating or applying something automatically.' },
  { name: 'MaximizeIcon', icon: MaximizeIcon, tier: 'glyph', brief: 'Four soft corners framing a square. For full screen or opening something larger.' },
  { name: 'MessageTextIcon', icon: MessageTextIcon, tier: 'glyph', brief: 'The Reviews soft bubble with a short line over a long one. For a written message or note.' },
  { name: 'MessageIcon', icon: MessageIcon, tier: 'glyph', brief: 'The Reviews soft bubble, empty. For a message or comment.' },
  { name: 'MicOffIcon', icon: MicOffIcon, tier: 'glyph', brief: 'The Mic capsule, stand and base with a slash through. For muted voice input.' },
  { name: 'MinusIcon', icon: MinusIcon, tier: 'glyph', brief: 'The horizontal stroke of PlusIcon. For removing or reducing.' },
  { name: 'MobileIcon', icon: MobileIcon, tier: 'glyph', brief: 'A tall soft phone with a dot at its foot. For the mobile preview.' },
  { name: 'TabletIcon', icon: TabletIcon, tier: 'glyph', brief: 'A soft iPad, wider than the phone, with a dot at its foot. For the iPad preview.' },
  { name: 'MenuIcon', icon: MenuIcon, tier: 'glyph', brief: 'Two even lines. Opens a page\'s navigation on a phone.' },
  { name: 'MoreIcon', icon: MoreIcon, tier: 'glyph', brief: 'Three heavy dots in a row (small rings, as in DragIcon, so they hold weight at 14px). For an overflow menu of more actions.' },
  { name: 'MoveHorizontalIcon', icon: MoveHorizontalIcon, tier: 'glyph', brief: 'A line with an arrowhead at each end, left and right. For resizing or moving something sideways.' },
  { name: 'MoveVerticalIcon', icon: MoveVerticalIcon, tier: 'glyph', brief: 'A line with an arrowhead at each end, up and down. For resizing or moving something up and down.' },
  { name: 'MusicIcon', icon: MusicIcon, tier: 'glyph', brief: 'Two round notes joined by a slanted beam. For music or audio.' },
  { name: 'PaletteIcon', icon: PaletteIcon, tier: 'glyph', brief: 'A round palette with a thumb notch and four paint dots. For colours and themes.' },
  { name: 'PanelTopIcon', icon: PanelTopIcon, tier: 'glyph', brief: 'A soft square with a band across its top. For a top panel or header area.' },
  { name: 'PauseIcon', icon: PauseIcon, tier: 'glyph', brief: 'Two soft upright bars. For pausing media.' },
  { name: 'PlayCircleIcon', icon: PlayCircleIcon, tier: 'glyph', brief: 'A ring with the Video play triangle inside. For a play button over media.' },
  { name: 'PlayIcon', icon: PlayIcon, tier: 'glyph', brief: 'A soft-cornered play triangle. For playing media.' },
  { name: 'PrinterIcon', icon: PrinterIcon, tier: 'glyph', brief: 'A soft body with a sheet feeding in at the top and a printed sheet out the front. For printing.' },
  { name: 'QuoteIcon', icon: QuoteIcon, tier: 'glyph', brief: 'Two soft quote marks. For a quote block.' },
  { name: 'RadiusIcon', icon: RadiusIcon, tier: 'glyph', brief: 'A square with tight corners except the top-right, drawn apart as one wide arc. For corner radius controls. The plain corners use rx 1.5 on purpose so the wide one stands out.' },
  { name: 'ReceiptIcon', icon: ReceiptIcon, tier: 'glyph', brief: 'A soft slip with a zigzag torn bottom and three lines. For a receipt or proof of payment.' },
  { name: 'RectangleIcon', icon: RectangleIcon, tier: 'glyph', brief: 'A plain wide soft rectangle. For a landscape shape or aspect.' },
  { name: 'RedoIcon', icon: RedoIcon, tier: 'glyph', brief: 'The UndoIcon mirrored, turning forward to the right. For redo.' },
  { name: 'ResetIcon', icon: ResetIcon, tier: 'glyph', brief: 'A circular arrow turning anticlockwise. For resetting to the default or starting over.' },
  { name: 'RowsIcon', icon: RowsIcon, tier: 'glyph', brief: 'A soft square split into three rows.' },
  { name: 'SearchIcon', icon: SearchIcon, tier: 'glyph', brief: 'A round lens with a short handle. For search and find.' },
  { name: 'SendToBackIcon', icon: SendToBackIcon, tier: 'glyph', brief: 'Two whole squares with a half-hidden one behind them. For send to back.' },
  { name: 'ShapesIcon', icon: ShapesIcon, tier: 'glyph', brief: 'A triangle over a soft square and a circle. For adding a shape.' },
  { name: 'SlidersIcon', icon: SlidersIcon, tier: 'glyph', brief: 'Three horizontal tracks, each with a round knob. For adjusting settings or display options.' },
  { name: 'SparklesIcon', icon: SparklesIcon, tier: 'glyph', brief: 'A large four-point sparkle with a small plus beside it. For AI and suggested content.' },
  { name: 'SpinnerIcon', icon: SpinnerIcon, tier: 'glyph', brief: 'An open three-quarter arc. Use with `animate-spin` for loading.' },
  { name: 'SquareIcon', icon: SquareIcon, tier: 'glyph', brief: 'A plain soft square. For a square shape or aspect.' },
  { name: 'StarIcon', icon: StarIcon, tier: 'glyph', brief: 'A five-point star with softened tips. The outline is computed (each outer point rounded by a quadratic 1.5 back along both edges, rounded to 2 decimals), so its coordinates are off the half-unit grid by design. For favourites and ratings.' },
  { name: 'StoreIcon', icon: StoreIcon, tier: 'glyph', brief: 'A scalloped awning over a soft shopfront with a door. For a shop, supplier or vendor.' },
  { name: 'BoldIcon', icon: BoldIcon, tier: 'glyph', brief: 'A bold B with a soft stem.' },
  { name: 'ItalicIcon', icon: ItalicIcon, tier: 'glyph', brief: 'A slanted I with top and bottom bars.' },
  { name: 'UnderlineIcon', icon: UnderlineIcon, tier: 'glyph', brief: 'A U over a rule.' },
  { name: 'StrikethroughIcon', icon: StrikethroughIcon, tier: 'glyph', brief: 'An S struck through the middle.' },
  { name: 'TextIcon', icon: TextIcon, tier: 'glyph', brief: 'Three lines of text, the last one short. For a text block.' },
  { name: 'TrashIcon', icon: TrashIcon, tier: 'glyph', brief: 'A soft bin with a lid, an arched handle and two ribs. For deleting.' },
  { name: 'TypeIcon', icon: TypeIcon, tier: 'glyph', brief: 'A T with turned-down arms, for text or font.' },
  { name: 'UndoIcon', icon: UndoIcon, tier: 'glyph', brief: 'An arrow turning back to the left over a soft hook. For undo.' },
  { name: 'UploadIcon', icon: UploadIcon, tier: 'glyph', brief: 'A soft cloud with an arrow rising into it. For uploading a file.' },
  { name: 'UserPlusIcon', icon: UserPlusIcon, tier: 'glyph', brief: 'The User figure with a plus to its right. For adding a person.' },
  { name: 'UserIcon', icon: UserIcon, tier: 'glyph', brief: 'One person, the Clients head and arch drawn larger. For a single person or account.' },
  { name: 'VideoOffIcon', icon: VideoOffIcon, tier: 'glyph', brief: 'The Video screen and triangle with a slash through, broken where it passes behind the triangle. For a camera or video that is off.' },
  { name: 'ZapIcon', icon: ZapIcon, tier: 'glyph', brief: 'A lightning bolt. For automations, quick actions and instant.' },
  { name: 'MaxPlanIcon', icon: MaxPlanIcon, tier: 'glyph', brief: 'A crown on a base line: the Max plan, or a feature that comes with it.' },
  { name: 'AccountManagerIcon', icon: AccountManagerIcon, tier: 'glyph', brief: 'A person with a speech bubble: a dedicated account manager, someone to talk to.' },
  { name: 'VoteIcon', icon: VoteIcon, tier: 'glyph', brief: 'A soft card with an upvote arrow: voting on what gets built.' },
];

/** Tier headings, their sizes on this page, and what each tier is for. */
const TIERS: { tier: IconTier; label: string; use: string; sizes: string[] }[] = [
  { tier: 'glyph', label: 'Glyph', use: '16 to 24px, inline with text and controls, beside Lucide. One colour (currentColor).', sizes: ['size-3.5', 'size-4', 'size-5'] },
  { tier: 'tile', label: 'Tile', use: 'About 40 to 48px, the art on a Blocks tile. May carry one accent token.', sizes: ['size-10', 'size-12'] },
  { tier: 'spot', label: 'Spot', use: 'About 96 to 160px, an empty state or onboarding moment. May carry one accent token.', sizes: ['size-24', 'size-40'] },
];

/** The Icons entry for the Foundations section. */
export function FoundationsIconsV2() {
  return (
    <Spec
      name="Icons"
      file="components/ui-v2/icons"
      description="Lucide for everything it has, at strokeWidth 1.5. Zebri's own icons for what it does not, made with /new-icon so every one follows the same grid. They take the same props as a Lucide icon and fill the same icon props."
    >
      <div className="space-y-10">
        {TIERS.map((t) => (
          <TierBlock key={t.tier} {...t} entries={ICONS.filter((i) => i.tier === t.tier)} />
        ))}
      </div>
    </Spec>
  );
}

/** One tier: its heading, its use, then each of its icons, or a line saying there are none yet. */
function TierBlock({ label, use, sizes, entries }: { label: string; use: string; sizes: string[]; entries: IconEntry[] }) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="type-label text-zebra-950">{label}</p>
        <p className="type-body text-zebra-500">{use}</p>
      </div>
      {entries.length === 0 ? (
        <p className="type-body text-zebra-400">None yet.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((e) => (
            <IconCell key={e.name} entry={e} sizes={sizes} />
          ))}
        </div>
      )}
    </div>
  );
}

/** One icon at each of its tier's sizes, on light and on ink, with its import. */
function IconCell({ entry, sizes }: { entry: IconEntry; sizes: string[] }) {
  const Icon = entry.icon;
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-end gap-4 text-zebra-950">
        {sizes.map((s) => (
          <Icon key={s} className={s} />
        ))}
        <span className="inline-flex items-end gap-4 rounded-button bg-zebra-950 p-2 text-zebra-50">
          {sizes.map((s) => (
            <Icon key={s} className={s} />
          ))}
        </span>
      </div>
      <p className="type-label text-zebra-950">{entry.name}</p>
      <p className="type-body text-zebra-500">{entry.brief}</p>
      <code className="block truncate type-code text-zebra-400">{`import { ${entry.name} } from '@/components/ui-v2/icons'`}</code>
    </div>
  );
}
