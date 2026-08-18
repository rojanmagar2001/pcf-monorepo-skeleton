import {
  type ApiClientConfig,
  type ApiClientHandle,
  type ApiError,
  configureApiClient,
  createQueryClient,
  createWebApiFetch,
  disposeQueryClient,
} from '@document-intake/api-client';
import type { QueryClient } from '@tanstack/react-query';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DocumentIntakeApp, type DocumentIntakeAppState } from './DocumentIntakeApp';
import type { IInputs, IOutputs } from './generated/ManifestTypes';
import { readControlInputs } from './inputs';
import { acquireStyles, releaseStyles } from './styles';

/**
 * Document Intake - a standard (non-virtual) PCF control.
 *
 * Every mutable thing it owns is per instance: the React root, the QueryClient,
 * and the api-client registration. The host may place several of these on one
 * form and destroy and recreate any of them, so nothing is cached at module
 * scope except the reference-counted <style> element, which tracks a single
 * shared DOM node rather than instance state.
 */
export class DocumentIntake implements ComponentFramework.StandardControl<IInputs, IOutputs> {
  private notifyOutputChanged!: () => void;
  private context!: ComponentFramework.Context<IInputs>;

  private root: Root | null = null;
  private queryClient: QueryClient | null = null;
  private apiHandle: ApiClientHandle | null = null;
  private apiConfig: ApiClientConfig | null = null;

  private initialPageSize = 25;
  private configurationError: string | null = null;
  private destroyed = false;

  private state: DocumentIntakeAppState = {
    selectedDocumentId: null,
    visibleDocumentCount: 0,
    lastError: null,
  };

  public init(
    context: ComponentFramework.Context<IInputs>,
    notifyOutputChanged: () => void,
    _state: ComponentFramework.Dictionary,
    container: HTMLDivElement,
  ): void {
    this.context = context;
    this.notifyOutputChanged = notifyOutputChanged;

    // One <style data-di-styles> for the whole page, reference counted so N
    // instances inject it exactly once.
    acquireStyles(container.ownerDocument);

    const inputs = readControlInputs(context.parameters);
    if (!inputs.ok) {
      this.configurationError = inputs.message;
    } else {
      this.initialPageSize = inputs.value.pageSize;
      this.apiConfig = {
        baseUrl: inputs.value.baseUrl,
        // Route through Dataverse rather than the network. The generated hooks
        // are unchanged; only the transport differs from the web harness.
        fetchImpl: createWebApiFetch(context),
        onError: (error: ApiError) => {
          this.state = { ...this.state, lastError: error.message };
          this.notifyOutputChanged();
        },
      };
      // Registered as the ambient fallback and disposed in destroy(); the
      // rendered tree resolves its config through <ApiProvider> instead.
      this.apiHandle = configureApiClient(this.apiConfig);
    }

    // Per instance, disposed in destroy(). Never a module-level singleton.
    this.queryClient = createQueryClient();
    this.root = createRoot(container);

    this.render();
  }

  public updateView(context: ComponentFramework.Context<IInputs>): void {
    this.context = context;
    this.render();
  }

  public getOutputs(): IOutputs {
    return {
      selectedDocumentId: this.state.selectedDocumentId ?? undefined,
      visibleDocumentCount: this.state.visibleDocumentCount,
      lastError: this.state.lastError ?? undefined,
    };
  }

  public destroy(): void {
    // Idempotent: a host may call destroy() more than once, and releasing the
    // shared stylesheet twice would strip it from sibling instances.
    if (this.destroyed) return;
    this.destroyed = true;

    // Unmount first so no in-flight render touches a disposed cache.
    this.root?.unmount();
    this.root = null;

    if (this.queryClient) {
      disposeQueryClient(this.queryClient);
      this.queryClient = null;
    }

    this.apiHandle?.dispose();
    this.apiHandle = null;
    this.apiConfig = null;

    // Removes the shared <style> only when this was the last instance.
    releaseStyles();
  }

  private handleStateChange = (next: DocumentIntakeAppState): void => {
    this.state = next;
    this.notifyOutputChanged();
  };

  private render(): void {
    if (!this.root) return;

    // A dataset binding is what lets a maker drop this on a form or subgrid;
    // the rows themselves come from the intake API through the generated hooks.
    const dataset = this.context.parameters.documents;
    const pageSize = dataset?.paging?.pageSize ?? this.initialPageSize;

    this.root.render(
      createElement(DocumentIntakeApp, {
        config: this.apiConfig ?? { baseUrl: '' },
        queryClient: this.queryClient as QueryClient,
        initialPageSize: pageSize,
        onStateChange: this.handleStateChange,
        configurationError: this.configurationError,
      }),
    );
  }
}
