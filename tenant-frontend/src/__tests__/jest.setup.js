// Mock window.location for JSDOM
// Note: Commenting out for now as JSDOM has a readonly location
// Object.defineProperty(window, 'location', {
//   value: {
//     href: '',
//     assign: jest.fn(),
//     replace: jest.fn(),
//     reload: jest.fn(),
//     toString: jest.fn(() => ''),
//   },
//   writable: true,
// })