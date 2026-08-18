import type { IInputs } from '../documentintake/generated/ManifestTypes';

/**
 * Typed test double for `ComponentFramework.Context`.
 *
 * The framework hands controls a large, deeply optional object. Rather than
 * scattering `as any` through the suite, this builds a genuinely typed context
 * covering the four surfaces the control actually touches: input parameters,
 * the dataset, `webAPI`, and the `notifyOutputChanged` callback - plus a
 * `pushUpdate` helper for driving `updateView`.
 */

export interface MockWebApi {
  retrieveMultipleRecords: jest.Mock;
  retrieveRecord: jest.Mock;
  createRecord: jest.Mock;
  updateRecord: jest.Mock;
  deleteRecord: jest.Mock;
}

export interface MockContextOptions {
  baseUrl?: string | null;
  pageSize?: number | null;
  /** Rows the mocked `retrieveMultipleRecords` should return. */
  records?: Record<string, unknown>[];
  /** Overrides for the dataset's paging block. */
  paging?: Partial<ComponentFramework.PropertyTypes.DataSet['paging']>;
}

export interface MockContext {
  context: ComponentFramework.Context<IInputs>;
  webAPI: MockWebApi;
  notifyOutputChanged: jest.Mock;
  container: HTMLDivElement;
  /** Replace input values and return the context to hand to `updateView`. */
  pushUpdate(next: Partial<MockContextOptions>): ComponentFramework.Context<IInputs>;
}

function createWebApi(records: Record<string, unknown>[]): MockWebApi {
  return {
    retrieveMultipleRecords: jest.fn(async () => ({ entities: records, nextLink: undefined })),
    retrieveRecord: jest.fn(async () => records[0] ?? {}),
    createRecord: jest.fn(async () => ({ entityType: 'di_document', id: 'created' })),
    updateRecord: jest.fn(async () => ({ entityType: 'di_document', id: 'updated' })),
    deleteRecord: jest.fn(async () => ({ entityType: 'di_document', id: 'deleted' })),
  };
}

function createDataset(
  paging: MockContextOptions['paging'],
): ComponentFramework.PropertyTypes.DataSet {
  return {
    addColumn: jest.fn(),
    columns: [],
    error: false,
    errorMessage: '',
    filtering: { getFilter: jest.fn(), setFilter: jest.fn(), clearFilter: jest.fn() },
    getSelectedRecordIds: jest.fn(() => []),
    setSelectedRecordIds: jest.fn(),
    openDatasetItem: jest.fn(),
    clearSelectedRecordIds: jest.fn(),
    linking: { getLinkedEntities: jest.fn(() => []), addLinkedEntity: jest.fn() },
    loading: false,
    paging: {
      totalResultCount: 0,
      firstPageNumber: 1,
      lastPageNumber: 1,
      pageSize: 25,
      hasNextPage: false,
      hasPreviousPage: false,
      loadNextPage: jest.fn(),
      loadPreviousPage: jest.fn(),
      reset: jest.fn(),
      setPageSize: jest.fn(),
      loadExactPage: jest.fn(),
      ...paging,
    },
    records: {},
    refresh: jest.fn(),
    sortedRecordIds: [],
    sorting: [],
  } as unknown as ComponentFramework.PropertyTypes.DataSet;
}

export function createMockContext(options: MockContextOptions = {}): MockContext {
  const {
    baseUrl = 'https://contoso.example/api/v1',
    pageSize = 25,
    records = [],
    paging,
  } = options;

  const webAPI = createWebApi(records);
  const notifyOutputChanged = jest.fn();
  const container = document.createElement('div');
  document.body.appendChild(container);

  const build = (
    currentBaseUrl: string | null,
    currentPageSize: number | null,
    currentPaging: MockContextOptions['paging'],
  ): ComponentFramework.Context<IInputs> =>
    ({
      parameters: {
        baseUrl: { raw: currentBaseUrl, error: false, errorMessage: '' },
        pageSize: { raw: currentPageSize, error: false, errorMessage: '' },
        documents: createDataset(currentPaging),
      },
      mode: {
        allocatedHeight: 480,
        allocatedWidth: 900,
        isControlDisabled: false,
        isVisible: true,
        label: 'Document Intake',
        setControlState: jest.fn(),
        setFullScreen: jest.fn(),
        trackContainerResize: jest.fn(),
      },
      webAPI: webAPI as unknown as ComponentFramework.WebApi,
      client: {
        disableScroll: false,
        getClient: () => 'Web',
        getFormFactor: () => 2,
        isOffline: () => false,
        isNetworkAvailable: () => true,
      },
      formatting: {} as ComponentFramework.Formatting,
      resources: { getString: (key: string) => key, getResource: jest.fn() },
      utils: {} as ComponentFramework.Utility,
      navigation: {} as ComponentFramework.Navigation,
      device: {} as ComponentFramework.Device,
      factory: {} as ComponentFramework.Factory,
      userSettings: {} as ComponentFramework.UserSettings,
      updatedProperties: [],
      events: {},
    }) as unknown as ComponentFramework.Context<IInputs>;

  let current = build(baseUrl, pageSize, paging);

  return {
    get context() {
      return current;
    },
    webAPI,
    notifyOutputChanged,
    container,
    pushUpdate(next) {
      current = build(
        next.baseUrl !== undefined ? next.baseUrl : baseUrl,
        next.pageSize !== undefined ? next.pageSize : pageSize,
        next.paging ?? paging,
      );
      return current;
    },
  };
}

/** An empty `ComponentFramework.Dictionary` for `init()`'s state argument. */
export const emptyState: ComponentFramework.Dictionary = {};
