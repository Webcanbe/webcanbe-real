export type SupportScenario = {title:string;signal:string;action:string}

export const supportScenarios:Record<string,SupportScenario[]> = {
 support:[
  {title:'A project is visible but cannot be opened',signal:'A Marketplace card or detail appears, yet the next screen is unavailable. This can be a listing state, an account permission, or a temporary load error; those causes need different remedies.',action:'Record the listing URL and the exact action. Check whether the same address opens directly after refresh, then include the visible error in your request.'},
  {title:'A preview behaves differently from a working copy',signal:'The public preview is a view of the released project. Your working copy has its own accepted source and later edits. A difference may be intentional if you edited your copy or selected another release.',action:'Compare the release identifier and project name in both places. Include the working-copy reference and the element that differs; avoid sending private source in the first message.'},
  {title:'An editor control is unavailable',signal:'A Visual control may be disabled when the selected element does not map safely to source. A disconnected preview is a different problem from an unsupported source pattern.',action:'Check whether other elements can be selected and whether Code opens the relevant file. The Visual and troubleshooting guides explain the common boundaries.'},
  {title:'You need the right support channel',signal:'Account access, money movement, a security exposure and a Creator review use different records and permissions. A general question can start here, but a specific channel makes the next review clearer.',action:'Choose Account Help, Billing Help, Security Report or Seller Support when one of those subjects is primary. Include only the safe reference relevant to that category.'},
 ],
 account:[
  {title:'The expected account is missing after sign-in',signal:'Signing in with another provider can lead to a different account identity. Project visibility and Purchases are scoped to the authenticated account, not just the email string shown in a browser.',action:'Check the provider you used previously and the account shown in Settings. Do not create repeated new accounts to test ownership of a purchase.'},
  {title:'A provider link did not complete',signal:'Opening an authorization window is only the first step. A blocked popup, cancelled consent or callback error can leave the original account unchanged.',action:'Return to Settings and inspect the connected-provider state. Include the provider name and safe error text, but remove callback codes and tokens.'},
  {title:'You cannot return to your project',signal:'A deep link should return to the intended project after authentication. If it instead opens a dashboard or login again, the destination or session may not have been preserved.',action:'Keep the original project URL and the route reached after sign-in. Report whether a direct visit after authentication succeeds.'},
  {title:'A session ended during editing',signal:'An expired session can interrupt save even while a local draft remains visible. Refreshing without checking the draft may make it harder to distinguish unsaved typing from accepted source.',action:'Note the last accepted revision and whether the editor still marks a draft. Sign in again through the product, then check History before repeating the save.'},
 ],
 sellers:[
  {title:'An application remains pending',signal:'A submitted application should retain a pending review state after refresh. Pending is not equivalent to Creator approval and should not expose another seller’s workspace.',action:'Include the application reference and date shown. Do not change a local role flag or resubmit repeatedly to force access.'},
  {title:'A submission returned with findings',signal:'Validation or review can identify source, metadata, compatibility or rights issues. A returned submission is not a published release.',action:'Use the findings to correct the candidate and resubmit through Creator Studio. Include the submission and affected release references if the finding is unclear.'},
  {title:'A public listing differs from the approved source',signal:'The gallery, detail and preview should all describe the same immutable release. A mismatch can mislead buyers about what they acquire.',action:'Record the listing URL, release identifier and precise element or file that differs. Stop promising the mismatched feature until review resolves it.'},
  {title:'A sale or payout number looks wrong',signal:'Orders, captured payments, refunds, holds and payout batches are separate records. A listing price is not the amount already paid to a Creator.',action:'Compare the ledger period and order references. Use Payout Issue for a batch discrepancy; do not send bank credentials.'},
 ],
 billing:[
  {title:'A payment was approved but access is missing',signal:'Provider approval, capture and entitlement happen at different steps. An approval screen alone cannot prove a purchase completed.',action:'Check Purchases for the final order state and avoid clicking Pay repeatedly. Include the safe order reference and approximate time.'},
  {title:'A plan appears different from the checkout amount',signal:'Plan cards summarize capacity and allowance, while checkout must show the actual billing period, currency and amount before authorization.',action:'Compare the plan name and final provider amount. Stop before approving if they differ and send the displayed values through Billing Help.'},
  {title:'AI allowance did not update',signal:'A request can be proposed, cancelled, failed or applied. An AI action should only affect the appropriate allowance according to the actual billing record.',action:'Check the action state and Billing view. Include the request reference and approximate time without pasting your prompt or source.'},
  {title:'You need a refund review',signal:'A request for review is not an executed refund. The final state depends on the recorded order, applicable policy and provider reconciliation.',action:'Use Refund Request with the order reference and reason. Continue to check Purchases for the authoritative transaction state.'},
 ],
 issues:[
  {title:'The page loads but an action does nothing',signal:'A route returning HTML is not proof that its button, form or preview action works. Capture the starting state, input and resulting screen.',action:'Give the shortest repeatable sequence, the expected result and the actual result. Include desktop or mobile viewport if layout affects the action.'},
  {title:'A save fails validation',signal:'A Code draft may contain a syntax error while the last accepted source still builds. The draft should remain available for correction.',action:'Keep the validation text and file reference, but do not paste private source. Correct the draft and retry; report if it disappears or overwrites accepted source.'},
  {title:'A preview stops reconnecting',signal:'A temporary connection error should be distinguishable from source incompatibility. Repeated retries can create a different problem if sessions accumulate.',action:'Record when the preview stopped, the project reference and whether Code or History still opens. Avoid opening many duplicate sessions.'},
  {title:'The problem appears only after refresh',signal:'A state that works only until navigation can indicate an unsaved draft, route mismatch or persistence failure.',action:'Describe what you changed, the save confirmation, the refreshed URL and the resulting state. The accepted revision is more useful than a screenshot alone.'},
 ],
 sales:[
  {title:'You need more project capacity',signal:'A team can have more projects than the current plan allows, while Marketplace purchases remain separate from subscription capacity.',action:'State the approximate active project count and team workflow. Compare the live Plans page before discussing a change.'},
  {title:'You are evaluating for an organization',signal:'Security review, account ownership, export and external-service setup may matter more than a promotional demo.',action:'Describe your intended deployment, data sensitivity and who will maintain exported source. Ask for specific supported capabilities, not an implied certification.'},
  {title:'You want a custom commercial arrangement',signal:'Published plans are the current self-service terms. A special price or service level is not established by a form submission.',action:'Describe expected usage, timing and the decision you need. A sales conversation can clarify options before any separate agreement.'},
  {title:'You need to compare product scope',signal:'Webcanbe helps you discover, edit and export projects. A particular project can still rely on third-party services or require developer work.',action:'Identify the template or release and the features you expect. Review compatibility and source ownership before estimating an adoption schedule.'},
 ],
 partnerships:[
  {title:'An educational collaboration',signal:'A course, workshop or guide may show a Webcanbe workflow without being an official Webcanbe program.',action:'Describe the audience, curriculum idea and whether the material would use actual projects. Provide a public sample you may share.'},
  {title:'A distribution proposal',signal:'A partner may want to present source projects to an audience. Listings still need rights, compatibility and Creator review where applicable.',action:'Explain which projects, rights holder and channels are involved. Do not imply automatic publication or seller approval.'},
  {title:'An integration idea',signal:'A proposed connection to another service is different from a supported product integration already available to users.',action:'Describe the user problem, required permissions and a reversible first use case. Avoid including a production API key.'},
  {title:'Co-branded material',signal:'Using two marks together can imply endorsement or a formal relationship that does not yet exist.',action:'Share the intended placement, copy, audience and duration. Review Webcanbe brand guidance before distributing the material.'},
 ],
 security:[
  {title:'You suspect cross-account access',signal:'A route or project appears to expose data outside the account you control. Further probing could affect someone else’s information.',action:'Stop at the first safe observation. Report the affected route and minimal steps without copying the other account’s data.'},
  {title:'A secret may be exposed',signal:'A token in source, a response or a log can create immediate risk. Posting it in an issue or support screenshot can increase exposure.',action:'Redact the value and report its type, location and approximate time privately. Rotate a key you own through its provider when appropriate.'},
  {title:'A payment boundary appears wrong',signal:'Checkout and entitlement must be decided by the server and provider records. A changed UI price or client flag must not grant a paid release.',action:'Use only a test account or transaction you control. Report the safe order reference and observed authorization boundary without attempting another person’s purchase.'},
  {title:'A project import behaves unexpectedly',signal:'Imported source can contain scripts and dependencies that need isolation. A suspicious operation in a project should be reported before wider testing.',action:'Preserve a minimal description and do not execute unknown code on another user’s behalf. Include the project reference and safe reproduction path.'},
 ],
 privacy:[
  {title:'You want a copy of account information',signal:'An access request needs to identify the account and scope. The public form should not collect an identity document or password up front.',action:'Specify which account and categories of information you are asking about. Be ready for a separate identity verification step if required.'},
  {title:'A profile detail is inaccurate',signal:'Correction may concern profile data, account identity or a transaction record. Changing display text does not necessarily rewrite an order audit trail.',action:'Name the field and the correct value or desired treatment. Include a safe record reference if the issue concerns a specific order.'},
  {title:'You want account data deleted',signal:'Deletion can involve active account data and records retained for legal or transaction reasons. The actual result depends on the applicable policy and obligations.',action:'Describe the account and requested scope. Do not assume a submitted form immediately removes a purchase, invoice or Creator ledger entry.'},
  {title:'You have a tracking question',signal:'Product analytics and required transaction records have different purposes. A question about a link event should identify the page and action without sending a browser cookie.',action:'Review the Privacy Policy and name the affected feature. The case can be routed for an account-specific response after verification.'},
 ],
 refunds:[
  {title:'The purchased release is unavailable',signal:'A completed order may appear in Purchases even if creating a working copy fails. The order and the copy need to be investigated separately.',action:'Include the order and release reference, and the action that failed. Check whether the entitlement is shown before submitting.'},
  {title:'The project differs from its listing',signal:'A static image or inaccurate feature description can affect a buyer’s decision. The release identity and its preview are important evidence.',action:'Identify the specific listing claim and the behavior in the acquired release. Do not send private source in the initial form.'},
  {title:'An order seems duplicated',signal:'Two provider records can be approvals, captures or reversals rather than two settled purchases. Repeating checkout may create more uncertainty.',action:'Provide both safe order references and approximate times. Avoid another attempt until the state is reconciled.'},
  {title:'You changed your mind after purchase',signal:'Refund eligibility depends on the recorded terms and circumstances, not an automatic form rule invented by the interface.',action:'Read the Refund Policy and explain the reason and order reference. Submission starts review; it does not execute a refund.'},
 ],
 payments:[
  {title:'You see a duplicate charge',signal:'A provider authorization can appear alongside a captured payment. The order ledger and provider state must be compared before calling it a duplicate sale.',action:'Include the safe order references, amount, currency and approximate times. Do not retry checkout while reconciliation is pending.'},
  {title:'Your provider shows a reversal',signal:'A reversal, refund and dispute are different events with different implications for entitlement and Creator accounting.',action:'Describe the provider state shown and the related Webcanbe order. The case can be matched to authoritative records.'},
  {title:'The order is missing in Purchases',signal:'A return from provider approval may not mean capture completed. An interrupted browser return can leave the user uncertain.',action:'Check Purchases after refresh and include the provider-approved time and safe reference. Avoid treating an approval screenshot as entitlement proof.'},
  {title:'A dispute is already open',signal:'A provider dispute has its own process. A support form cannot decide or close it by itself.',action:'Include the case or order reference without payment credentials. Keep provider communications and the Webcanbe case aligned.'},
 ],
 payouts:[
  {title:'A sale is held',signal:'A completed buyer order can produce a Creator ledger entry that is not yet available for payout under the applicable terms.',action:'Check the order, hold reason and period. Include the safe order reference if the hold appears inconsistent.'},
  {title:'A payout batch is pending',signal:'The batch state indicates processing, not completed transfer. A support message should not mark it paid.',action:'Provide the batch reference and state shown. Compare the same currency and date range before reporting an amount difference.'},
  {title:'A refund reduced the balance',signal:'A reversing ledger entry can affect available funds while preserving the original sale record for audit.',action:'Compare the affected order and refund reference. Ask for reconciliation if the reversal does not match the recorded transaction.'},
  {title:'A dispute changed the period total',signal:'A dispute or hold can cross reporting periods. A dashboard sum and a paid payout may then differ for legitimate reasons.',action:'Use the order and batch references, relevant period and currency. Do not send bank account numbers through this form.'},
 ],
}

const additional:Record<string,SupportScenario[]>={
 support:[
  {title:'You are unsure which project revision is active',signal:'A preview, draft and accepted revision can look similar during editing, but only the accepted source is the durable project state.',action:'Open History and note the latest accepted revision. Include that reference and the screen where the content differs.'},
  {title:'A help article and the live screen disagree',signal:'The route and control names in a guide should help you complete the task on the current product. An outdated instruction can leave you at the wrong destination.',action:'Send the guide URL, the live route and the step that no longer matches. This lets support distinguish a documentation issue from an account restriction.'},
 ],
 account:[
  {title:'A connected account shows the wrong name',signal:'A provider identity and Webcanbe display profile are related but separate records. A profile edit may not change the provider account shown at login.',action:'Check the profile and connected-provider screens, then include the field and provider that differ. Do not send a provider access token.'},
  {title:'You need to sign out of another session',signal:'Closing a browser tab is not always equivalent to revoking a stored session. The account guide explains the available session controls.',action:'Use the supported session or logout action, then revisit the protected route. Include the device context only if it is relevant and safe to share.'},
 ],
 sellers:[
  {title:'A Creator release needs a correction',signal:'A published release remains an immutable reference for earlier buyers. Changing a draft cannot silently alter those acquired files.',action:'Describe the defect and affected release. Use the review process for a new version or documented remedy rather than replacing files behind the listing.'},
  {title:'A rights document is unclear',signal:'An asset may be displayed in a preview but lack redistribution permission for buyer source export.',action:'Identify the asset and the license question without posting a private agreement publicly. Pause publication of uncertain material while the case is reviewed.'},
 ],
 billing:[
  {title:'A subscription cancellation is unclear',signal:'Stopping renewal and refunding a past payment are different actions. The screen should show the effective state and any remaining period.',action:'Record the subscription reference and state shown after cancellation. Use Refund Request separately if a completed charge needs review.'},
  {title:'A receipt or currency differs',signal:'Provider, order and displayed plan records should identify the same transaction and currency. A mismatch needs reconciliation before a conclusion.',action:'Include the safe order reference, amount and currency shown in each place. Do not upload a statement with full payment details.'},
 ],
 issues:[
  {title:'A control is hidden on a small screen',signal:'A menu, dialog or editor pane can be clipped by a narrow viewport even though it works on desktop.',action:'State the viewport or device class, route and control label. Include whether keyboard navigation can still reach it.'},
  {title:'A button opens the wrong route',signal:'A successful navigation can still be a defect when it loses the selected project, filter or return destination.',action:'Copy the starting and resulting paths without tokens. Note whether back, forward and refresh preserve the intended state.'},
 ],
 sales:[
  {title:'You need a purchasing comparison',signal:'A plan subscription and a Marketplace project acquisition solve different needs; one may not include the other.',action:'Name the plan and specific project release under consideration. Ask which costs and rights apply to each before forecasting spend.'},
  {title:'You need an export evaluation',signal:'A source export can be run outside Webcanbe, but a particular project may still need external accounts, compatible runtimes or licensed assets.',action:'Describe the deployment target and project type. Review the export guide and ask about any concrete unsupported dependency.'},
 ],
 partnerships:[
  {title:'A project creator wants wider reach',signal:'Distribution through Webcanbe still depends on Creator approval, rights evidence and release review.',action:'Explain the existing project, rights holder and audience. Use the Creator application for a listing rather than treating a partnership form as publication.'},
  {title:'A proposed event uses the brand',signal:'A workshop or event announcement can imply sponsorship if Webcanbe marks and wording are used without agreement.',action:'Share the draft context and placement. Keep the event described as independent until any co-branding terms are confirmed.'},
 ],
 security:[
  {title:'A bug report contains private evidence',signal:'Logs and screenshots can contain tokens, email addresses, source snippets or payment references that should not be published.',action:'Redact unnecessary values before submitting. Use the private security channel when the issue itself could expose another person’s data.'},
  {title:'You need to preserve a safe reproduction',signal:'A minimal action using your own account is usually enough to describe a suspected boundary failure.',action:'Write down the route, prerequisite and first unexpected response. Stop before repeating it against other accounts or running broad scans.'},
 ],
 privacy:[
  {title:'A support case includes the wrong contact email',signal:'A request may need correction without exposing an unrelated account. The requester identity has to be verified before private details can be disclosed.',action:'Provide the case reference and intended contact address through the privacy form. Do not attach another person’s message history.'},
  {title:'You need a copy for a specific period',signal:'A broad request can be harder to interpret when the concern is one order, project or date range.',action:'Describe the period and record type. Keep any supporting order reference safe and leave credentials out of the form.'},
  {title:'You want to know what remains after deletion',signal:'Some records can have separate legal or transaction retention reasons. The relevant Privacy Policy and case response should explain the actual scope.',action:'Ask for a category-level explanation and include the earlier case reference if this is a follow-up.'},
 ],
 refunds:[
  {title:'The wrong release was acquired',signal:'A project title may have multiple versions. The order should identify the exact release and terms accepted.',action:'Provide the order and expected release reference. Explain how the selection differed from the completed order without editing the acquired record.'},
  {title:'A provider refund is pending',signal:'A refund decision and provider settlement can appear at different times. The case is not complete merely because a request was submitted.',action:'Check the order and provider states before another request. Include the refund reference if one was issued.'},
 ],
 payments:[
  {title:'A charge completed after a browser error',signal:'The browser may show a failed return while the provider and server finished a capture. Retrying blindly can create duplicate work.',action:'Refresh Purchases and compare the order reference first. Submit the case if provider and Webcanbe states still differ.'},
  {title:'A zero-cost project asks for payment',signal:'A first-party free template should not be presented as a paid provider order merely because it follows an acquisition action.',action:'Record the project detail and checkout route. Stop before authorizing an unexpected amount and report the mismatch.'},
 ],
 payouts:[
  {title:'A payout was marked completed but not received',signal:'The product ledger and external transfer have separate confirmations. A displayed paid state needs an actual payout reference.',action:'Include the batch reference, date and state shown. Do not send banking credentials in the public form.'},
  {title:'Two currencies were combined',signal:'Adding amounts across currencies without a recorded conversion can make a payout total appear wrong. The source order and payout batch must each retain their currency context.',action:'Compare each order and batch in its own currency, then provide the references that still fail to reconcile. Include the period used for the comparison.'},
 ],
}
for(const [slug,items] of Object.entries(additional))supportScenarios[slug].push(...items)
