import { Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { OrganizationNameDto } from './dto/organization-name.dto.js';
import { organizationCreateInvalidation, organizationRenameInvalidation } from './organization-invalidation.js';
import { OrganizationResponse, serializeOrganization } from './organization-response.js';
import { OrganizationService } from './organization.service.js';
import type { AccessTokenPayload } from '../core/access-token-payload.js';
import { CacheClass } from '../core/cache-class.js';
import { InvalidatesPaths } from '../core/cache-invalidation.decorator.js';
import { CachePolicy } from '../core/cache-policy.decorator.js';
import { CurrentUser } from '../core/current-user.decorator.js';
import { ownerNotFound, parseOrgId } from '../core/parse-org-id.js';
import { StrictBody } from '../core/strict-validation.pipe.js';

/**
 * Organization routes (`/orgs.json`, `/orgs/:orgId.json`) — thin, delegating
 * to `OrganizationService`. JWT-protected (no `@Public()`). Not owner-scoped:
 * it is the organization itself, so it parses `:orgId` with `parseOrgId()`
 * (taken as a raw string, never a number, so `1e3` cannot become `1000`) and
 * checks membership through the service; every miss (unknown, malformed,
 * non-member — including a non-member global admin) answers the uniform 404.
 * Renaming needs the `admin` or `owner` role (uniform 403 for a `user`); the
 * order is 400 body → 404 membership → 403 role.
 * Bodies come only through `@StrictBody()`, so unknown fields (`role`,
 * `organizationId`) answer 400. Cache class: `never` at the controller level,
 * narrowed to `user-scoped` on the GETs. Writes declare the paths they invalidate
 * (`/orgs.json`, plus `/orgs/<id>.json` on rename — never `/orgs`). Names are never logged.
 */
@Controller()
@CachePolicy(CacheClass.Never)
export class OrganizationController {
  private readonly organizationService: OrganizationService;

  /**
   * @param {OrganizationService} organizationService - Organizations and memberships.
   */
  constructor(organizationService: OrganizationService) {
    this.organizationService = organizationService;
  }

  /**
   * `GET /orgs.json`. Lists the caller's organizations with their role in each.
   * @param {AccessTokenPayload} caller - The authenticated user.
   * @returns {Promise<OrganizationResponse[]>} The caller's organizations, ordered by id.
   */
  @Get('orgs.json')
  @CachePolicy(CacheClass.UserScoped)
  async list(@CurrentUser() caller: AccessTokenPayload): Promise<OrganizationResponse[]> {
    const organizations = await this.organizationService.listForUser(caller.sub);

    return organizations.map(({ organization, role }) => serializeOrganization(organization, role));
  }

  /**
   * `POST /orgs.json`. Creates an organization; the caller becomes its `owner`.
   * @param {AccessTokenPayload} caller - The authenticated user.
   * @param {OrganizationNameDto} dto - The organization's name (only field accepted).
   * @returns {Promise<OrganizationResponse>} The created organization, with role `owner`.
   */
  @Post('orgs.json')
  @InvalidatesPaths(organizationCreateInvalidation)
  async create(
    @CurrentUser() caller: AccessTokenPayload,
      @StrictBody() dto: OrganizationNameDto,
  ): Promise<OrganizationResponse> {
    const { organization, role } = await this.organizationService.create(caller.sub, dto.name);

    return serializeOrganization(organization, role);
  }

  /**
   * `GET /orgs/:orgId.json`. Shows an organization the caller is a member of.
   * @param {AccessTokenPayload} caller - The authenticated user.
   * @param {string} rawOrgId - The raw `:orgId` route parameter.
   * @returns {Promise<OrganizationResponse>} The organization, with the caller's role.
   */
  @Get('orgs/:orgId.json')
  @CachePolicy(CacheClass.UserScoped)
  async show(
    @CurrentUser() caller: AccessTokenPayload,
      @Param('orgId') rawOrgId: string,
  ): Promise<OrganizationResponse> {
    const found = await this.organizationService.findMembership(caller.sub, parseOrgId(rawOrgId));

    if (!found) {
      throw ownerNotFound();
    }

    return serializeOrganization(found.organization, found.membership.role);
  }

  /**
   * `PATCH /orgs/:orgId.json`. Renames an organization the caller is an `admin` or `owner` of.
   * The order is 400 body → 404 membership → 403 role. The body is validated before `:orgId` or
   * membership is checked, so an invalid body answers 400 even for an unknown or foreign
   * organization; this is deliberate, as the 400 depends only on the body and cannot be used to
   * enumerate organizations (owner-scoped routes answer their 404 first instead). A member whose
   * role is `user` gets the uniform 403, after the membership check.
   * @param {AccessTokenPayload} caller - The authenticated user.
   * @param {string} rawOrgId - The raw `:orgId` route parameter.
   * @param {OrganizationNameDto} dto - The new name (only field accepted, required).
   * @returns {Promise<OrganizationResponse>} The renamed organization, with the caller's role.
   */
  @Patch('orgs/:orgId.json')
  @InvalidatesPaths(organizationRenameInvalidation)
  async rename(
    @CurrentUser() caller: AccessTokenPayload,
      @Param('orgId') rawOrgId: string,
      @StrictBody() dto: OrganizationNameDto,
  ): Promise<OrganizationResponse> {
    const { organization, role } = await this.organizationService.rename(caller.sub, parseOrgId(rawOrgId), dto.name);

    return serializeOrganization(organization, role);
  }
}
