<?php
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Every email Lotmates sends, as templates the team can edit from the dashboard.
 * Each event has a default; the team's edits are stored on top. Every send is logged,
 * which also stops the scheduled ones (reminders, unfinished checkouts) going out twice.
 */

// ---------- Catalogue ----------

function lm_email_catalogue()
{
    $b = ['first_name', 'name', 'deal_name', 'deal_link', 'booking_ref', 'booking_link', 'homes', 'amount_paid', 'price_now', 'schedule', 'address', 'community', 'locality', 'vendor_name', 'closes_on', 'support_email', 'site_link'];
    $d = ['first_name', 'name', 'deal_name', 'deal_link', 'price_now', 'first_price', 'best_price', 'booked_count', 'minimum', 'community', 'locality', 'vendor_name', 'closes_on', 'support_email', 'site_link'];
    return [
        // Neighbours
        'n_welcome' => [
            'role' => 'Customer_c', 'name' => 'Welcome', 'when' => 'Right after a neighbour creates an account.',
            'tags' => ['first_name', 'name', 'deals_link', 'support_email', 'site_link'],
            'subject' => 'Welcome to Lotmates, {first_name}',
            'heading' => 'Your locality buys together',
            'body' => "Hi {first_name},\n\nThanks for joining Lotmates. When neighbours book the same service together, the price drops for everyone, and people who booked early get the difference back.\n\nSee what's on in your locality and book in a couple of taps.",
            'button' => 'See deals near you', 'link' => '{deals_link}',
            'footnote' => 'Questions? Reply to this email or write to {support_email}.',
        ],
        'n_booking_paid' => [
            'role' => 'Customer_c', 'name' => 'Booking received', 'when' => 'As soon as a payment goes through.',
            'tags' => array_merge($b, ['next_price', 'more_needed']),
            'subject' => "You're in: {deal_name}",
            'heading' => "You're in",
            'body' => "Hi {first_name},\n\nWe've got your booking for {deal_name}: {homes}, {amount_paid} paid.\n\n- When: {schedule}\n- Where: {address}\n\nThe price is {price_now} right now. {more_needed} more neighbours and it drops to {next_price}, and the difference comes back to you when the deal closes on {closes_on}.\n\nShare the deal with your neighbours to bring the price down faster.",
            'button' => 'View your booking', 'link' => '{booking_link}',
            'footnote' => 'Booking {booking_ref}. You can cancel for a full refund until the deal closes.',
        ],
        'n_checkout_abandoned' => [
            'role' => 'Customer_c', 'name' => 'Unfinished checkout', 'when' => 'Hours after a neighbour starts paying but doesn\'t finish, while the deal is still open.',
            'delay' => 1, 'delayLabel' => 'hours after leaving checkout', 'delayMax' => 20,
            'tags' => $d,
            'subject' => 'Still want {deal_name}?',
            'heading' => 'Your spot is waiting',
            'body' => "Hi {first_name},\n\nYou started booking {deal_name} but didn't finish paying. No money was taken.\n\n{booked_count} neighbours have booked so far and the price is {price_now}. The deal closes on {closes_on}.",
            'button' => 'Finish booking', 'link' => '{deal_link}',
            'footnote' => "If the payment did go through, ignore this. Your booking will show up within a few minutes.",
        ],
        'n_deal_closing' => [
            'role' => 'Customer_c', 'name' => 'Deal closing soon', 'when' => 'Hours before a deal closes, to neighbours who booked it.',
            'delay' => 24, 'delayLabel' => 'hours before the deal closes', 'delayMax' => 72,
            'tags' => array_merge($b, ['booked_count', 'next_price', 'more_needed']),
            'subject' => '{deal_name} closes soon',
            'heading' => 'A few more neighbours?',
            'body' => "Hi {first_name},\n\n{deal_name} closes on {closes_on}. {booked_count} neighbours are in at {price_now}.\n\n{more_needed} more bookings and the price drops to {next_price} for everyone, including you. Share the link in your community group.",
            'button' => 'Open the deal', 'link' => '{deal_link}',
            'footnote' => 'Booking {booking_ref}.',
        ],
        'n_deal_confirmed' => [
            'role' => 'Customer_c', 'name' => 'Deal went ahead (invoice)', 'when' => 'When a deal closes with enough neighbours. The invoice PDF is attached.',
            'tags' => array_merge($b, ['final_price', 'total', 'refund', 'invoice_number']),
            'subject' => 'Invoice {invoice_number}: {deal_name}',
            'heading' => 'Your booking is confirmed',
            'body' => "Hi {first_name},\n\n{deal_name} closed with enough neighbours, so your booking is confirmed at {final_price} each.\n\n- Your booking: {homes}, {total}\n- Coming back to you: {refund}\n- When: {schedule}\n\nThe vendor will be in touch before the day. Your invoice is attached.",
            'button' => 'View your booking', 'link' => '{booking_link}',
            'footnote' => 'Refunds reach your original payment method within 5 to 7 working days.',
        ],
        'n_deal_failed' => [
            'role' => 'Customer_c', 'name' => "Deal didn't go ahead", 'when' => "When a deal closes without enough neighbours.",
            'tags' => array_merge($b, ['refund', 'minimum']),
            'subject' => 'Full refund: {deal_name}',
            'heading' => "This deal didn't go ahead",
            'body' => "Hi {first_name},\n\n{deal_name} needed {minimum} homes by {closes_on} and didn't get there, so it won't go ahead.\n\nYou're getting all of it back: {refund}.",
            'button' => 'See other deals', 'link' => '{deals_link}',
            'footnote' => 'Refunds reach your original payment method within 5 to 7 working days.',
        ],
        'n_refund_sent' => [
            'role' => 'Customer_c', 'name' => 'Refund sent', 'when' => 'When a refund is sent through Razorpay.',
            'tags' => array_merge($b, ['refund']),
            'subject' => '{refund} is on its way back to you',
            'heading' => 'Refund sent',
            'body' => "Hi {first_name},\n\nWe've sent {refund} back for {deal_name} (booking {booking_ref}).",
            'button' => 'View your booking', 'link' => '{booking_link}',
            'footnote' => 'It reaches your original payment method within 5 to 7 working days.',
        ],
        'n_booking_cancelled' => [
            'role' => 'Customer_c', 'name' => 'Booking cancelled', 'when' => 'When a neighbour or the team cancels a booking.',
            'tags' => array_merge($b, ['refund']),
            'subject' => 'Booking {booking_ref} cancelled',
            'heading' => 'Your booking is cancelled',
            'body' => "Hi {first_name},\n\nYour booking for {deal_name} is cancelled and {refund} is coming back to you.",
            'button' => 'See other deals', 'link' => '{deals_link}',
            'footnote' => 'Refunds reach your original payment method within 5 to 7 working days.',
        ],
        'n_service_reminder' => [
            'role' => 'Customer_c', 'name' => 'Service reminder', 'when' => 'Hours before the preferred service date on a confirmed booking.',
            'delay' => 18, 'delayLabel' => 'hours before the service day', 'delayMax' => 72,
            'tags' => array_merge($b, ['service_date', 'time_slot', 'phone']),
            'subject' => 'Reminder: {deal_name} on {service_date}',
            'heading' => 'See you soon',
            'body' => "Hi {first_name},\n\nA reminder about {deal_name} with {vendor_name}.\n\n- When: {schedule}\n- Address: {address}\n- They'll call: {phone}\n\nNeed a different day? Reply to this email and we'll sort it out.",
            'button' => 'View your booking', 'link' => '{booking_link}',
            'footnote' => 'Booking {booking_ref}.',
        ],
        'n_review_request' => [
            'role' => 'Customer_c', 'name' => 'Ask for a review', 'when' => 'Hours after a job is marked done.',
            'delay' => 24, 'delayLabel' => 'hours after the job is done', 'delayMax' => 168,
            'tags' => $b,
            'subject' => 'How did {vendor_name} do?',
            'heading' => 'Rate the job',
            'body' => "Hi {first_name},\n\nHow was {deal_name}? A quick rating helps your neighbours choose, and helps us keep vendors honest.",
            'button' => 'Rate this job', 'link' => '{booking_link}',
            'footnote' => 'It takes under a minute.',
        ],
        'n_password_reset' => [
            'role' => 'All', 'name' => 'Password reset', 'when' => 'When anyone asks to reset their password.',
            'tags' => ['first_name', 'name', 'email', 'reset_link', 'support_email', 'site_link'],
            'subject' => 'Reset your Lotmates password',
            'heading' => 'Choose a new password',
            'body' => "Hi {first_name},\n\nSomeone asked to reset the password for your Lotmates account ({email}).",
            'button' => 'Choose a new password', 'link' => '{reset_link}',
            'footnote' => "If you didn't ask for this, ignore this email. Your password stays the same.",
            'locked' => ['link'],
        ],

        'n_email_changed' => [
            'role' => 'All', 'name' => 'Email address changed', 'when' => 'Sent to the old address when anyone changes their sign-in email.',
            'tags' => ['first_name', 'name', 'new_email', 'support_email', 'site_link'],
            'subject' => 'Your Lotmates email was changed',
            'heading' => 'Your sign-in email changed',
            'body' => "Hi {first_name},\n\nThe email on your Lotmates account was changed to {new_email}.",
            'button' => '', 'link' => '',
            'footnote' => "If you didn't do this, write to {support_email} right away.",
        ],

        'x_team_invite' => [
            'role' => 'All', 'name' => 'Team invite', 'when' => 'When the team invites someone new as team, vendor or ambassador.',
            'tags' => ['email', 'role', 'inviter', 'invite_link', 'expires_on', 'support_email', 'site_link'],
            'subject' => "You're invited to Lotmates",
            'heading' => 'Join Lotmates as {role}',
            'body' => "Hi,\n\n{inviter} has invited you to Lotmates as {role}. Set your name and password to get started.",
            'button' => 'Accept the invite', 'link' => '{invite_link}',
            'footnote' => "The link works once and expires on {expires_on}. Not expecting this? Ignore it.",
            'locked' => ['link'],
        ],
        'x_access_granted' => [
            'role' => 'All', 'name' => 'New access given', 'when' => 'When someone who already has an account is given team, vendor or ambassador access.',
            'tags' => ['first_name', 'name', 'role', 'signin_link', 'support_email', 'site_link'],
            'subject' => 'You now have {role} access on Lotmates',
            'heading' => 'Your access changed',
            'body' => "Hi {first_name},\n\nYou can now use Lotmates as {role}. Sign in with your usual email and password.",
            'button' => 'Sign in', 'link' => '{signin_link}',
            'footnote' => "Didn't expect this? Write to {support_email}.",
        ],

        // Vendors
        'v_deal_live' => [
            'role' => 'Vendor_c', 'name' => 'Your deal is live', 'when' => 'When the team publishes a deal for the vendor.',
            'tags' => $d,
            'subject' => '{deal_name} is live',
            'heading' => 'Your deal is live',
            'body' => "Hi {first_name},\n\n{deal_name} is now open for bookings in {locality}. It goes ahead at {minimum} homes and closes on {closes_on}.\n\nWe'll tell you as soon as it closes.",
            'button' => 'See the deal', 'link' => '{deal_link}',
            'footnote' => '',
        ],
        'v_deal_closed' => [
            'role' => 'Vendor_c', 'name' => 'Deal closed: your jobs', 'when' => 'When a vendor\'s deal closes and goes ahead.',
            'tags' => array_merge($d, ['final_price', 'jobs_link']),
            'subject' => '{deal_name}: {booked_count} homes booked',
            'heading' => 'New jobs for you',
            'body' => "Hi {first_name},\n\n{deal_name} closed with {booked_count} homes at {final_price} each.\n\nYour jobs, with addresses and preferred dates, are in your Lotmates dashboard. Please call each neighbour to fix a time.",
            'button' => 'See your jobs', 'link' => '{jobs_link}',
            'footnote' => '',
        ],
        'v_payout_sent' => [
            'role' => 'Vendor_c', 'name' => 'Payout sent', 'when' => 'When the team marks a payout as paid.',
            'tags' => ['first_name', 'name', 'deal_name', 'payout_amount', 'payout_reference', 'payouts_link', 'support_email', 'site_link'],
            'subject' => 'Payout of {payout_amount} sent',
            'heading' => 'Payout sent',
            'body' => "Hi {first_name},\n\nWe've paid {payout_amount} for {deal_name}. Bank reference: {payout_reference}.",
            'button' => 'See your payouts', 'link' => '{payouts_link}',
            'footnote' => 'Questions about a payout? Write to {support_email}.',
        ],

        // Ambassadors
        'v_application_received' => [
            'role' => 'Vendor_c', 'name' => 'Vendor application received', 'when' => 'When a business applies from the public vendors page.',
            'tags' => ['first_name', 'business', 'category', 'areas', 'contact', 'terms_link', 'site_link'],
            'subject' => 'We got your application, {business}',
            'heading' => 'Thanks for applying, {first_name}',
            'body' => "We've received {business}'s application to run deals on Lotmates.\n\n- Offering: {category}\n- Areas: {areas}\n\nSomeone from the team will get in touch {contact} to learn about your business. Before your first deal, we check your ID, the licences your trade needs, references from past customers and a test job, and verify your bank account for payouts. Your vendor account is set up only after that.",
            'button' => 'Read the vendor terms', 'link' => '{terms_link}',
            'footnote' => '',
        ],
        'v_application_declined' => [
            'role' => 'Vendor_c', 'name' => 'Vendor application declined', 'when' => 'When the team declines a vendor application and chooses to tell them.',
            'tags' => ['first_name', 'business', 'team_note', 'site_link'],
            'subject' => 'Your Lotmates vendor application',
            'heading' => 'About your application',
            'body' => "Hi {first_name},\n\nThank you for applying to run deals on Lotmates with {business}. We're not able to take your application forward right now.\n\n{team_note}",
            'button' => '', 'link' => '',
            'footnote' => '',
        ],
        'a_deal_live' => [
            'role' => 'Ambassador_c', 'name' => 'New deal for your community', 'when' => 'When a deal opens for a community the ambassador represents.',
            'tags' => $d,
            'subject' => 'New for {community}: {deal_name}',
            'heading' => 'A new deal to share',
            'body' => "Hi {first_name},\n\n{deal_name} is open for {community}. It starts at {first_price} and can drop to {best_price} as neighbours join. It goes ahead at {minimum} homes and closes on {closes_on}.\n\nShare it in your community group to get it going.",
            'button' => 'Open the deal', 'link' => '{deal_link}',
            'footnote' => '',
        ],
        'a_deal_closed' => [
            'role' => 'Ambassador_c', 'name' => 'Deal closed in your community', 'when' => 'When a deal in their community closes.',
            'tags' => array_merge($d, ['final_price', 'outcome']),
            'subject' => '{deal_name}: {outcome}',
            'heading' => 'A deal has closed',
            'body' => "Hi {first_name},\n\n{deal_name} closed with {booked_count} homes: {outcome}.\n\nThank you for sharing it.",
            'button' => 'See your communities', 'link' => '{site_link}/ambassador',
            'footnote' => '',
        ],

        'a_application_received' => [
            'role' => 'Ambassador_c', 'name' => 'Ambassador application received', 'when' => 'When someone applies to be an ambassador from the public page.',
            'tags' => ['first_name', 'community', 'contact', 'terms_link', 'site_link'],
            'subject' => 'We got your ambassador application',
            'heading' => 'Thanks for applying, {first_name}',
            'body' => "We've received your application to be the Lotmates ambassador for {community}.\n\nSomeone from the team will get in touch {contact} to learn about your community and answer your questions. Your ambassador account is set up only after that conversation.\n\nIn the meantime, you can read the ambassador terms.",
            'button' => 'Read the ambassador terms', 'link' => '{terms_link}',
            'footnote' => 'You can still book deals as a neighbour while we review your application.',
        ],
        'a_application_declined' => [
            'role' => 'Ambassador_c', 'name' => 'Ambassador application declined', 'when' => 'When the team declines an application and chooses to tell the applicant.',
            'tags' => ['first_name', 'community', 'team_note', 'site_link'],
            'subject' => 'Your Lotmates ambassador application',
            'heading' => 'About your application',
            'body' => "Hi {first_name},\n\nThank you for applying to be the Lotmates ambassador for {community}. We're not able to take your application forward right now.\n\n{team_note}\n\nYou can still book deals as a neighbour.",
            'button' => 'See live deals', 'link' => '{site_link}/deals',
            'footnote' => '',
        ],
        'a_proposal_received' => [
            'role' => 'Ambassador_c', 'name' => 'Proposal received', 'when' => 'When an ambassador sends a deal proposal.',
            'tags' => ['first_name', 'proposal_name', 'category', 'community', 'homes', 'contact', 'proposal_link', 'site_link'],
            'subject' => 'We got your proposal: {proposal_name}',
            'heading' => 'Thanks, your proposal is with the team',
            'body' => "Hi {first_name},\n\nThe Lotmates team has your proposal and will look at it soon.\n\n- What: {proposal_name}\n- Category: {category}\n- Community: {community}\n- Homes interested: {homes}\n\nWe'll reach you {contact}. You can edit or delete the proposal until the team starts reviewing it.",
            'button' => 'View your proposal', 'link' => '{proposal_link}',
            'footnote' => '',
        ],
        'a_proposal_update' => [
            'role' => 'Ambassador_c', 'name' => 'Proposal update', 'when' => 'When the team changes a proposal\'s status or writes a note on it.',
            'tags' => ['first_name', 'proposal_name', 'status', 'status_line', 'team_note', 'proposal_link', 'site_link'],
            'subject' => '{proposal_name}: {status}',
            'heading' => 'Your proposal is now {status}',
            'body' => "Hi {first_name},\n\n{status_line}\n\n{team_note}",
            'button' => 'View your proposal', 'link' => '{proposal_link}',
            'footnote' => 'Reply to this email if you have questions.',
        ],

        // Team
        't_deal_closed' => [
            'role' => 'Admin_c', 'name' => 'Deal closed summary', 'when' => 'When any deal closes, to the Lotmates team.',
            'tags' => array_merge($d, ['final_price', 'outcome', 'refunds_total', 'admin_deal_link']),
            'subject' => 'Closed: {deal_name} ({outcome})',
            'heading' => '{deal_name} has closed',
            'body' => "{booked_count} homes booked, minimum {minimum}: {outcome}.\n\n- Final price: {final_price}\n- Refunds: {refunds_total}\n\nInvoices and refund emails are going out to neighbours now.",
            'button' => 'Open in the dashboard', 'link' => '{admin_deal_link}',
            'footnote' => '',
        ],
        't_new_proposal' => [
            'role' => 'Admin_c', 'name' => 'New deal proposal', 'when' => 'When an ambassador proposes a deal.',
            'tags' => ['proposer_name', 'proposal_name', 'category', 'community', 'homes', 'notes', 'contact', 'proposal_link', 'site_link'],
            'subject' => 'New proposal: {proposal_name}',
            'heading' => '{proposer_name} proposed a deal',
            'body' => "- What: {proposal_name}\n- Category: {category}\n- Community: {community}\n- Homes interested: {homes}\n- Contact: {contact}\n\n{notes}",
            'button' => 'Review the proposal', 'link' => '{proposal_link}',
            'footnote' => '',
        ],
        't_new_vendor_application' => [
            'role' => 'Admin_c', 'name' => 'New vendor application', 'when' => 'When a business applies to be a vendor.',
            'tags' => ['business', 'name', 'email', 'phone', 'category', 'areas', 'services', 'contact', 'application_link'],
            'subject' => 'Vendor application: {business} ({category})',
            'heading' => '{business} wants to run deals',
            'body' => "- Contact: {name}, {contact}\n- Email: {email}\n- Offering: {category}\n- Areas: {areas}\n\n{services}\n\nGet in touch and run the checks before approving.",
            'button' => 'Review the application', 'link' => '{application_link}',
            'footnote' => '',
        ],
        't_new_application' => [
            'role' => 'Admin_c', 'name' => 'New ambassador application', 'when' => 'When someone applies to be an ambassador.',
            'tags' => ['name', 'email', 'phone', 'community', 'homes', 'relation', 'about', 'contact', 'application_link'],
            'subject' => 'Ambassador application: {name}, {community}',
            'heading' => '{name} wants to be an ambassador',
            'body' => "- Community: {community}\n- Homes: {homes}\n- Connection: {relation}\n- Contact: {contact}\n- Email: {email}\n\n{about}\n\nGet in touch with them before approving.",
            'button' => 'Review the application', 'link' => '{application_link}',
            'footnote' => '',
        ],
        't_proposal_reply' => [
            'role' => 'Admin_c', 'name' => 'Ambassador update on a proposal', 'when' => 'When an ambassador adds an update to their proposal.',
            'tags' => ['proposer_name', 'proposal_name', 'update', 'homes_change', 'homes', 'community', 'contact', 'proposal_link', 'site_link'],
            'subject' => 'Update on {proposal_name} from {proposer_name}',
            'heading' => '{proposer_name} added an update',
            'body' => "{homes_change}\n\n{update}\n\nCommunity: {community}\nContact: {contact}",
            'button' => 'Open the proposal', 'link' => '{proposal_link}',
            'footnote' => '',
        ],
        't_deletion_request' => [
            'role' => 'Admin_c', 'name' => 'Account deletion request', 'when' => 'When someone asks for their account to be deleted.',
            'tags' => ['name', 'email', 'role', 'user_id', 'site_link'],
            'subject' => 'Account deletion request: {name}',
            'heading' => 'Someone wants their account deleted',
            'body' => "{name} ({email}, {role}, user {user_id}) asked for their Lotmates account to be deleted.\n\nSettle any open bookings or refunds first, then remove the account from WordPress Users.",
            'button' => '', 'link' => '',
            'footnote' => '',
        ],
    ];
}

const LM_EMAIL_FIELDS = ['enabled', 'subject', 'heading', 'body', 'button', 'link', 'footnote', 'delay'];

/** One template: the default with the team's edits on top. */
function lm_email_template($event)
{
    $cat = lm_email_catalogue();
    if (!isset($cat[$event])) {
        return null;
    }
    $def = $cat[$event] + ['enabled' => true, 'delay' => null];
    $saved = get_option('lm_email_templates', []);
    $t = $def;
    foreach (LM_EMAIL_FIELDS as $f) {
        if (isset($saved[$event][$f]) && !in_array($f, $def['locked'] ?? [], true)) {
            $t[$f] = $saved[$event][$f];
        }
    }
    $t['event'] = $event;
    $t['edited'] = !empty($saved[$event]);
    return $t;
}

function lm_email_save($event, $in)
{
    $cat = lm_email_catalogue();
    if (!isset($cat[$event])) {
        return false;
    }
    $saved = get_option('lm_email_templates', []);
    $row = [
        'enabled' => !empty($in['enabled']),
        'subject' => mb_substr(sanitize_text_field((string) ($in['subject'] ?? '')), 0, 200),
        'heading' => mb_substr(sanitize_text_field((string) ($in['heading'] ?? '')), 0, 160),
        'body' => mb_substr(sanitize_textarea_field((string) ($in['body'] ?? '')), 0, 5000),
        'button' => mb_substr(sanitize_text_field((string) ($in['button'] ?? '')), 0, 60),
        'link' => mb_substr(trim(sanitize_text_field((string) ($in['link'] ?? ''))), 0, 300),
        'footnote' => mb_substr(sanitize_textarea_field((string) ($in['footnote'] ?? '')), 0, 600),
    ];
    if (isset($cat[$event]['delay'])) {
        $row['delay'] = max(1, min((int) ($cat[$event]['delayMax'] ?? 168), (int) ($in['delay'] ?? $cat[$event]['delay'])));
    }
    if ($row['subject'] === '') {
        $row['subject'] = $cat[$event]['subject'];
    }
    $saved[$event] = $row;
    update_option('lm_email_templates', $saved, false);
    return true;
}

// ---------- Log ----------

function lm_install_email_log()
{
    global $wpdb;
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    $t = $wpdb->prefix . 'lm_email_log';
    dbDelta("CREATE TABLE $t (
Id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
event VARCHAR(40) NOT NULL,
refId BIGINT UNSIGNED NULL,
userId BIGINT UNSIGNED NULL,
toEmail VARCHAR(190) NULL,
subject VARCHAR(255) NULL,
status VARCHAR(20) NOT NULL,
createdOn DATETIME NOT NULL,
PRIMARY KEY  (Id),
KEY event_ref (event, refId),
KEY createdOn (createdOn)
) " . $wpdb->get_charset_collate() . ';');
}

function lm_email_already($event, $ref, $user_id = null)
{
    global $wpdb;
    $sql = 'SELECT COUNT(*) FROM ' . $wpdb->prefix . "lm_email_log WHERE event = %s AND refId = %d AND status = 'sent'";
    $args = [$event, (int) $ref];
    if ($user_id) {
        $sql .= ' AND userId = %d';
        $args[] = (int) $user_id;
    }
    return (int) $wpdb->get_var($wpdb->prepare($sql, $args)) > 0;
}

function lm_email_log($event, $ref, $user_id, $to, $subject, $status)
{
    global $wpdb;
    $wpdb->insert($wpdb->prefix . 'lm_email_log', [
        'event' => $event, 'refId' => $ref ? (int) $ref : null, 'userId' => $user_id ? (int) $user_id : null,
        'toEmail' => $to, 'subject' => mb_substr((string) $subject, 0, 250), 'status' => $status, 'createdOn' => gmdate('Y-m-d H:i:s'),
    ]);
}

// ---------- Rendering ----------

function lm_email_fill($text, $ctx, $html)
{
    return preg_replace_callback('/\{([a-z_]+)\}/', function ($m) use ($ctx, $html) {
        if (!array_key_exists($m[1], $ctx)) {
            return $m[0];
        }
        $v = (string) $ctx[$m[1]];
        return $html ? esc_html($v) : $v;
    }, (string) $text);
}

/** Plain text to email HTML: blank lines make paragraphs, "- " lines make a list. */
function lm_email_body_html($body, $ctx)
{
    $out = '';
    foreach (preg_split("/\n\s*\n/", trim(str_replace("\r", '', (string) $body))) as $block) {
        $lines = explode("\n", $block);
        if (count(array_filter($lines, fn($l) => preg_match('/^\s*[-•]\s+/', $l))) === count($lines)) {
            $out .= '<ul style="margin:0 0 16px;padding-left:20px;color:#3d544b;font-size:15px;line-height:1.6">';
            foreach ($lines as $l) {
                $out .= '<li style="margin:2px 0">' . lm_email_fill(preg_replace('/^\s*[-•]\s+/', '', $l), $ctx, true) . '</li>';
            }
            $out .= '</ul>';
        } else {
            $out .= '<p style="margin:0 0 16px;color:#3d544b;font-size:15px;line-height:1.6">' . implode('<br>', array_map(fn($l) => lm_email_fill($l, $ctx, true), $lines)) . '</p>';
        }
    }
    return $out;
}

function lm_email_render($t, $ctx)
{
    $s = lm_invoice_settings();
    $subject = lm_email_fill($t['subject'], $ctx, false);
    $heading = lm_email_fill($t['heading'], $ctx, true);
    $body = lm_email_body_html($t['body'], $ctx);
    $link = trim(lm_email_fill($t['link'], $ctx, false));
    $button = trim(lm_email_fill($t['button'], $ctx, true));
    $foot = lm_email_fill($t['footnote'], $ctx, true);
    $pre = esc_html(mb_substr(trim(preg_replace('/\s+/', ' ', lm_email_fill(preg_replace('/^Hi [^,\n]*,\s*/', '', (string) $t['body']), $ctx, false))), 0, 120));
    $html = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"></head><body style="margin:0;background:#f3f6f2;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">'
        . '<div style="display:none;max-height:0;overflow:hidden;opacity:0">' . $pre . '</div>'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6f2;padding:32px 12px"><tr><td align="center">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;padding:32px">'
        . '<tr><td style="padding-bottom:24px"><img src="' . esc_url(LM_SITE_URL . '/icon-192.png') . '" width="28" height="28" alt="" style="vertical-align:middle;border-radius:6px"> <span style="font-size:22px;font-weight:800;color:#1f5c45;letter-spacing:-0.5px;vertical-align:middle">lotmates</span></td></tr>'
        . ($heading !== '' ? '<tr><td style="font-size:24px;font-weight:700;color:#1d3b30;line-height:1.25;padding-bottom:14px">' . $heading . '</td></tr>' : '')
        . '<tr><td>' . $body . '</td></tr>'
        . ($button !== '' && preg_match('~^https?://~', $link) ? '<tr><td style="padding:10px 0 8px"><a href="' . esc_url($link) . '" style="display:inline-block;background:#1f5c45;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 26px;border-radius:999px">' . $button . '</a></td></tr>' : '')
        . (trim($foot) !== '' ? '<tr><td style="font-size:13px;color:#62706a;line-height:1.6;padding-top:18px">' . nl2br($foot) . '</td></tr>' : '')
        . '</table>'
        . '<p style="font-size:12px;color:#8a978f;margin:18px 0 0">' . esc_html($s['name']) . ', ' . esc_html(preg_replace('~^https?://~', '', LM_SITE_URL)) . '</p>'
        . '</td></tr></table></body></html>';
    return ['subject' => $subject, 'html' => $html];
}

// ---------- Context (merge tags) ----------

function lm_email_money($n)
{
    return '₹' . preg_replace('/^INR /', '', lm_money($n, 0));
}

function lm_email_date($v, $fmt = 'D j M, g:i a')
{
    return $v ? lm_ist_date($v, $fmt) : '';
}

function lm_email_ctx_base()
{
    $s = lm_invoice_settings();
    return ['support_email' => $s['email'], 'site_link' => LM_SITE_URL, 'deals_link' => LM_SITE_URL . '/deals'];
}

function lm_email_ctx_user($user)
{
    if (!$user) {
        return [];
    }
    $name = trim($user->first_name . ' ' . $user->last_name) ?: $user->display_name;
    return ['first_name' => $user->first_name ?: strtok($name, ' '), 'name' => $name, 'email' => $user->user_email, 'user_id' => $user->ID];
}

function lm_email_ctx_deal($deal)
{
    if (!$deal) {
        return [];
    }
    $st = lm_deal_state($deal);
    $tiers = $st['tiers'];
    $next = $tiers[$st['reached']] ?? null;
    $vendor = $deal['vendor_c'] ? lm_row('vendors_c', $deal['vendor_c']) : null;
    $community = $deal['community_c'] ? lm_row('communities_c', $deal['community_c']) : null;
    $locality = $deal['locality_c'] ? lm_row('localities_c', $deal['locality_c']) : null;
    return [
        'deal_name' => $deal['Name'],
        'deal_link' => LM_SITE_URL . '/deals/' . $deal['Id'],
        'admin_deal_link' => LM_SITE_URL . '/admin/deals/' . $deal['Id'],
        'price_now' => isset($st['current']['price']) ? lm_email_money($st['current']['price']) : '',
        'final_price' => isset($st['current']['price']) ? lm_email_money($st['current']['price']) : '',
        'first_price' => isset($tiers[0]) ? lm_email_money($tiers[0]['price']) : '',
        'best_price' => $tiers ? lm_email_money(end($tiers)['price']) : '',
        'next_price' => $next ? lm_email_money($next['price']) : 'the best price',
        'more_needed' => $next ? max(1, (int) $next['from'] - (int) $st['booked']) : 0,
        'booked_count' => (int) $st['booked'],
        'minimum' => (int) ($deal['minHomes_c'] ?? 0),
        'community' => $community['Name'] ?? ($locality['Name'] ?? ''),
        'locality' => $locality['Name'] ?? '',
        'vendor_name' => $vendor['Name'] ?? 'The vendor',
        'closes_on' => lm_email_date($deal['deadline_c']),
        'jobs_link' => LM_SITE_URL . '/vendor',
        'outcome' => $deal['status_c'] === 'Failed' ? "didn't go ahead" : 'went ahead',
    ];
}

function lm_email_ctx_booking($b)
{
    $deal = $b['deal_c'] ? lm_row('deals_c', $b['deal_c']) : null;
    $user = $b['Owner'] ? get_user_by('id', (int) $b['Owner']) : null;
    $homes = max(1, (int) $b['homes_c']);
    $unit = $deal ? preg_replace('/^per\s+/i', '', (string) $deal['unit_c']) : 'home';
    $community = $b['community_c'] ? lm_row('communities_c', $b['community_c']) : null;
    $rate = $b['finalPrice_c'] !== null ? (float) $b['finalPrice_c'] : (float) $b['unitPrice_c'];
    return array_merge(lm_email_ctx_base(), lm_email_ctx_deal($deal), lm_email_ctx_user($user), [
        'booking_ref' => $b['Name'],
        'booking_link' => LM_SITE_URL . '/bookings/' . $b['Id'],
        'homes' => $homes . ' ' . $unit . ($homes === 1 || preg_match('/s$/', $unit) ? '' : 's'),
        'amount_paid' => lm_email_money($b['amountPaid_c']),
        'total' => lm_email_money($rate * $homes),
        'refund' => lm_email_money($b['refundDue_c'] ?: 0),
        'service_date' => $b['preferredDate_c'] ? lm_ist_date($b['preferredDate_c'], 'l j M') : 'the agreed day',
        'time_slot' => $b['preferredSlot_c'] ?: '',
        'schedule' => $deal ? lm_schedule_line($b, $deal) : '',
        'address' => $b['address_c'] ?: '',
        'phone' => $b['phone_c'] ?: '',
        'invoice_number' => $b['invoiceNo_c'] ?: '',
    ], $community ? ['community' => $community['Name']] : []);
}

// ---------- Sending ----------

/**
 * Send one templated email. Returns true when sent. $once makes it skip if this event
 * already went to this person about this record.
 */
function lm_send_template($event, $to, $ctx, $opts = [])
{
    $t = lm_email_template($event);
    if (!$t || (empty($t['enabled']) && empty($opts['force'])) || !is_email($to)) {
        return false;
    }
    $ref = $opts['ref'] ?? null;
    $uid = $opts['user'] ?? null;
    if (!empty($opts['once']) && $ref && lm_email_already($event, $ref, $uid)) {
        return false;
    }
    $mail = lm_email_render($t, $ctx + lm_email_ctx_base());
    $ok = lm_mail($to, $mail['subject'], $mail['html'], $opts['attachments'] ?? []);
    lm_email_log($event, $ref, $uid, $to, $mail['subject'], $ok ? 'sent' : 'failed');
    return (bool) $ok;
}

function lm_email_booking($event, $booking_id, $opts = [])
{
    $b = is_array($booking_id) ? $booking_id : lm_row('bookings_c', $booking_id);
    if (!$b || !$b['Owner']) {
        return false;
    }
    $user = get_user_by('id', (int) $b['Owner']);
    if (!$user) {
        return false;
    }
    return lm_send_template($event, $user->user_email, lm_email_ctx_booking($b), $opts + ['ref' => $b['Id'], 'user' => $user->ID]);
}

function lm_team_recipients()
{
    $emails = [get_option('admin_email')];
    foreach (get_users(['role' => 'lm_admin', 'fields' => ['user_email']]) as $u) {
        $emails[] = $u->user_email;
    }
    return array_values(array_unique(array_filter($emails, 'is_email')));
}

/** Vendor user(s) and ambassador(s) linked to a deal. */
function lm_deal_people($deal)
{
    global $wpdb;
    $out = ['vendor' => [], 'ambassador' => []];
    if (!empty($deal['vendor_c'])) {
        $v = lm_row('vendors_c', $deal['vendor_c']);
        if ($v && $v['user_c'] && ($u = get_user_by('id', (int) $v['user_c']))) {
            $out['vendor'][] = $u;
        }
    }
    $ct = lm_table('communities_c');
    if (!empty($deal['community_c'])) {
        $ids = $wpdb->get_col($wpdb->prepare("SELECT ambassadorUser_c FROM $ct WHERE Id = %d AND ambassadorUser_c IS NOT NULL", $deal['community_c']));
    } elseif (!empty($deal['locality_c'])) {
        $ids = $wpdb->get_col($wpdb->prepare("SELECT DISTINCT ambassadorUser_c FROM $ct WHERE locality_c = %d AND ambassadorUser_c IS NOT NULL", $deal['locality_c']));
    } else {
        $ids = [];
    }
    foreach (array_unique(array_map('intval', $ids)) as $id) {
        if ($u = get_user_by('id', $id)) {
            $out['ambassador'][] = $u;
        }
    }
    return $out;
}

function lm_email_deal_people($event_vendor, $event_ambassador, $deal, $extra = [])
{
    $people = lm_deal_people($deal);
    $ctx = lm_email_ctx_base() + lm_email_ctx_deal($deal) + $extra;
    foreach ($people['vendor'] as $u) {
        lm_send_template($event_vendor, $u->user_email, lm_email_ctx_user($u) + $ctx, ['ref' => $deal['Id'], 'user' => $u->ID, 'once' => true]);
    }
    foreach ($people['ambassador'] as $u) {
        $c = $ctx;
        lm_send_template($event_ambassador, $u->user_email, lm_email_ctx_user($u) + $c, ['ref' => $deal['Id'], 'user' => $u->ID, 'once' => true]);
    }
}

// ---------- Triggers ----------

add_action('lm_booking_paid', function ($booking_id) {
    lm_email_booking('n_booking_paid', $booking_id, ['once' => true]);
});

add_action('lm_refund_sent', function ($booking_id) {
    lm_email_booking('n_refund_sent', $booking_id);
});

add_action('lm_booking_cancelled', function ($booking_id) {
    lm_email_booking('n_booking_cancelled', $booking_id, ['once' => true]);
});

add_action('lm_user_registered', function ($user_id) {
    $u = get_user_by('id', $user_id);
    if ($u) {
        lm_send_template('n_welcome', $u->user_email, lm_email_ctx_user($u), ['ref' => $user_id, 'user' => $user_id, 'once' => true]);
    }
});

add_action('lm_deal_closed', function ($deal_id, $result) {
    $deal = lm_row('deals_c', $deal_id);
    if (!$deal) {
        return;
    }
    $extra = ['refunds_total' => lm_email_money($result['totalRefund'] ?? 0)];
    if (!empty($result['unlocked'])) {
        lm_email_deal_people('v_deal_closed', 'a_deal_closed', $deal, $extra);
    } else {
        // Vendors hear nothing about a deal that failed; ambassadors do.
        $people = lm_deal_people($deal);
        $ctx = lm_email_ctx_base() + lm_email_ctx_deal($deal) + $extra;
        foreach ($people['ambassador'] as $u) {
            lm_send_template('a_deal_closed', $u->user_email, lm_email_ctx_user($u) + $ctx, ['ref' => $deal['Id'], 'user' => $u->ID, 'once' => true]);
        }
    }
    foreach (lm_team_recipients() as $to) {
        lm_send_template('t_deal_closed', $to, lm_email_ctx_base() + lm_email_ctx_deal($deal) + $extra + ['first_name' => 'team', 'name' => 'Team'], ['ref' => $deal['Id']]);
    }
}, 10, 2);

// The team's dashboard edits: a deal going live, a payout marked paid, a booking cancelled by hand.
add_action('lm_record_changed', function ($table, $id, $before, $after) {
    if (!$after) {
        return;
    }
    if ($table === 'deals_c' && $after['status_c'] === 'Live' && (!$before || $before['status_c'] !== 'Live')) {
        lm_email_deal_people('v_deal_live', 'a_deal_live', $after);
    }
    if ($table === 'payouts_c' && $after['status_c'] === 'Paid' && (!$before || $before['status_c'] !== 'Paid') && $after['vendorUser_c']) {
        $u = get_user_by('id', (int) $after['vendorUser_c']);
        $deal = $after['deal_c'] ? lm_row('deals_c', $after['deal_c']) : null;
        if ($u) {
            lm_send_template('v_payout_sent', $u->user_email, lm_email_ctx_user($u) + [
                'deal_name' => $deal['Name'] ?? 'your deal',
                'payout_amount' => lm_email_money($after['net_c']),
                'payout_reference' => $after['reference_c'] ?: 'shared separately',
                'payouts_link' => LM_SITE_URL . '/payouts',
            ], ['ref' => $id, 'user' => $u->ID, 'once' => true]);
        }
    }
    if ($table === 'proposals_c') {
        lm_email_proposal_change((int) $id, $before, $after);
    }
    if ($table === 'bookings_c' && $before && $after['status_c'] === 'Cancelled' && $before['status_c'] !== 'Cancelled') {
        do_action('lm_booking_cancelled', (int) $id);
    }
}, 10, 4);

// Password reset emails use the template too.
add_filter('retrieve_password_notification_email', function ($defaults, $key, $login, $user) {
    $t = lm_email_template('n_password_reset');
    if (!$t || empty($t['enabled'])) {
        return $defaults;
    }
    $token = rtrim(strtr(base64_encode($login . "\n" . $key), '+/', '-_'), '=');
    $mail = lm_email_render($t, lm_email_ctx_base() + lm_email_ctx_user($user) + ['reset_link' => LM_SITE_URL . '/reset-password?token=' . $token]);
    lm_email_log('n_password_reset', $user->ID, $user->ID, $user->user_email, $mail['subject'], 'sent');
    return ['to' => $user->user_email, 'subject' => $mail['subject'], 'message' => $mail['html'], 'headers' => ['Content-Type: text/html; charset=UTF-8']];
}, 20, 4);

// ---------- Scheduled: unfinished checkouts and reminders ----------

function lm_run_scheduled_emails()
{
    global $wpdb;
    $bt = lm_table('bookings_c');
    $dt = lm_table('deals_c');
    $now = time();

    // Unfinished checkouts: unpaid for N hours (within a day), deal still open, nothing paid since.
    $t = lm_email_template('n_checkout_abandoned');
    if (!empty($t['enabled'])) {
        $h = max(1, (int) $t['delay']);
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT b.* FROM $bt b JOIN $dt d ON d.Id = b.deal_c WHERE b.paymentStatus_c = 'Pending' AND d.status_c = 'Live' AND d.deadline_c > UTC_TIMESTAMP()
             AND b.CreatedOn <= %s AND b.CreatedOn >= %s",
            gmdate('Y-m-d H:i:s', $now - $h * 3600), gmdate('Y-m-d H:i:s', $now - 23 * 3600)
        ), ARRAY_A);
        $seen = [];
        foreach ($rows as $b) {
            $key = $b['Owner'] . '-' . $b['deal_c'];
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $paid = (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $bt WHERE Owner = %d AND deal_c = %d AND paymentStatus_c <> 'Pending'", $b['Owner'], $b['deal_c']));
            // One nudge per person per deal, ever.
            if (!$paid && !lm_email_already('n_checkout_abandoned', $b['deal_c'], $b['Owner'])) {
                $ctx = lm_email_ctx_booking($b);
                $u = get_user_by('id', (int) $b['Owner']);
                if ($u) {
                    lm_send_template('n_checkout_abandoned', $u->user_email, $ctx, ['ref' => $b['deal_c'], 'user' => $u->ID]);
                }
            }
        }
    }

    // Deal closing soon: to everyone booked on deals closing within N hours.
    $t = lm_email_template('n_deal_closing');
    if (!empty($t['enabled'])) {
        $h = max(1, (int) $t['delay']);
        $deals = $wpdb->get_col($wpdb->prepare("SELECT Id FROM $dt WHERE status_c = 'Live' AND deadline_c > UTC_TIMESTAMP() AND deadline_c <= %s", gmdate('Y-m-d H:i:s', $now + $h * 3600)));
        foreach ($deals as $deal_id) {
            $ids = $wpdb->get_col($wpdb->prepare("SELECT Id FROM $bt WHERE deal_c = %d AND status_c = 'Booked' AND paymentStatus_c = 'Paid'", $deal_id));
            foreach ($ids as $id) {
                lm_email_booking('n_deal_closing', (int) $id, ['once' => true]);
            }
        }
    }

    // Service reminder: N hours before 10:00 IST on the preferred day.
    $t = lm_email_template('n_service_reminder');
    if (!empty($t['enabled'])) {
        $h = max(1, (int) $t['delay']);
        $rows = $wpdb->get_results("SELECT Id, preferredDate_c FROM $bt WHERE status_c = 'Confirmed' AND preferredDate_c IS NOT NULL AND preferredDate_c >= CURDATE() - INTERVAL 1 DAY AND preferredDate_c <= CURDATE() + INTERVAL 4 DAY", ARRAY_A);
        foreach ($rows as $r) {
            $service = (new DateTimeImmutable($r['preferredDate_c'] . ' 10:00', new DateTimeZone('Asia/Kolkata')))->getTimestamp();
            if ($now >= $service - $h * 3600 && $now < $service) {
                lm_email_booking('n_service_reminder', (int) $r['Id'], ['once' => true]);
            }
        }
    }

    // Review request: N hours after a job is marked done (only recent jobs).
    $t = lm_email_template('n_review_request');
    if (!empty($t['enabled'])) {
        $h = max(1, (int) $t['delay']);
        $rt = lm_table('reviews_c');
        $ids = $wpdb->get_col($wpdb->prepare(
            "SELECT b.Id FROM $bt b WHERE b.status_c = 'Done' AND b.ModifiedOn <= %s AND b.ModifiedOn >= %s
             AND NOT EXISTS (SELECT 1 FROM $rt r WHERE r.booking_c = b.Id)",
            gmdate('Y-m-d H:i:s', $now - $h * 3600), gmdate('Y-m-d H:i:s', $now - ($h + 14 * 24) * 3600)
        ));
        foreach ($ids as $id) {
            lm_email_booking('n_review_request', (int) $id, ['once' => true]);
        }
    }
}
add_action('lm_hourly', 'lm_run_scheduled_emails', 30);

// ---------- Sample data for previews and tests ----------

function lm_email_sample_ctx($event, $user)
{
    $base = lm_email_ctx_base() + lm_email_ctx_user($user);
    return $base + [
        'deal_name' => 'Deep cleaning, 2BHK', 'deal_link' => LM_SITE_URL . '/deals', 'admin_deal_link' => LM_SITE_URL . '/admin/deals',
        'booking_ref' => 'LM-4211', 'booking_link' => LM_SITE_URL . '/bookings', 'homes' => '2 homes', 'amount_paid' => '₹6,998',
        'price_now' => '₹2,899', 'final_price' => '₹2,899', 'first_price' => '₹3,499', 'best_price' => '₹2,699', 'next_price' => '₹2,699',
        'more_needed' => 4, 'booked_count' => 27, 'minimum' => 10, 'community' => 'Green Meadows Apartments', 'locality' => 'Lakeview',
        'vendor_name' => 'Sparkle Home Care', 'closes_on' => lm_email_date(gmdate('Y-m-d H:i:s', time() + 3 * 86400)),
        'total' => '₹5,798', 'refund' => '₹1,200', 'invoice_number' => lm_invoice_settings()['prefix'] . '/' . lm_fy() . '/0042',
        'service_date' => lm_ist_date(gmdate('Y-m-d', time() + 86400), 'l j M'), 'address' => 'B-402, Tower 2', 'phone' => '+91 98765 43210',
        'time_slot' => 'Morning, 8 am to 12 pm', 'schedule' => 'Preferred: ' . lm_ist_date(gmdate('Y-m-d', time() + 86400), 'l j M') . ', morning, 8 am to 12 pm',
        'jobs_link' => LM_SITE_URL . '/vendor', 'outcome' => 'went ahead', 'refunds_total' => '₹18,400',
        'payout_amount' => '₹42,500', 'payout_reference' => 'UTR 4021 7781', 'payouts_link' => LM_SITE_URL . '/payouts',
        'reset_link' => LM_SITE_URL . '/reset-password', 'role' => 'Neighbour',
        'proposal_name' => 'Overhead water tank cleaning', 'proposal_link' => LM_SITE_URL . '/proposals', 'proposer_name' => 'Meena S',
        'category' => 'Water tank cleaning (new category)', 'contact' => 'by phone at +91 98765 43210',
        'notes' => 'Notes: Most blocks want it before the monsoon.', 'status' => 'under review',
        'status_line' => 'The team is looking into your proposal and talking to vendors about it.',
        'team_note' => "Note from the team:\nWe're asking two vendors for tier prices.",
        'business' => 'Sparkle Home Care', 'areas' => 'Lakeview, Hillside', 'services' => 'Deep cleaning for apartments and villas, with our own equipment and a trained crew of six.',
        'update' => 'Two more blocks have signed up since last week.', 'relation' => 'Association member',
        'about' => 'I run the residents WhatsApp group for 180 homes.', 'application_link' => LM_SITE_URL . '/admin/ambassador-applications', 'terms_link' => LM_SITE_URL . '/legal/ambassadors', 'homes_change' => 'Homes interested: 15 → 25',
    ];
}

// ---------- Routes (team only) ----------

function lm_register_email_routes()
{
    $ns = 'lotmates/v1';
    $admin = function () {
        return lm_is_admin(wp_get_current_user()) ? true : new WP_Error('lm_forbidden', 'Only the Lotmates team can manage emails.', ['status' => 403]);
    };
    $public = function ($t) {
        return [
            'event' => $t['event'], 'role' => $t['role'], 'name' => $t['name'], 'when' => $t['when'], 'tags' => array_values(array_unique(array_merge($t['tags'], ['support_email', 'site_link']))),
            'enabled' => (bool) $t['enabled'], 'subject' => $t['subject'], 'heading' => $t['heading'], 'body' => $t['body'], 'button' => $t['button'], 'link' => $t['link'],
            'footnote' => $t['footnote'], 'delay' => $t['delay'] ?? null, 'delayLabel' => $t['delayLabel'] ?? null, 'delayMax' => $t['delayMax'] ?? null,
            'locked' => $t['locked'] ?? [], 'edited' => $t['edited'], 'attachment' => $t['event'] === 'n_deal_confirmed' ? 'Invoice PDF' : null,
        ];
    };

    register_rest_route($ns, '/emails', [
        'methods' => 'GET',
        'permission_callback' => $admin,
        'callback' => function () use ($public) {
            global $wpdb;
            $out = [];
            foreach (array_keys(lm_email_catalogue()) as $e) {
                $t = $public(lm_email_template($e));
                $t['sent30'] = (int) $wpdb->get_var($wpdb->prepare('SELECT COUNT(*) FROM ' . $wpdb->prefix . "lm_email_log WHERE event = %s AND status = 'sent' AND createdOn >= UTC_TIMESTAMP() - INTERVAL 30 DAY", $e));
                $out[] = $t;
            }
            return ['templates' => $out];
        },
    ]);

    register_rest_route($ns, '/emails/(?P<event>[a-z_]+)', [
        'methods' => 'POST',
        'permission_callback' => $admin,
        'callback' => function (WP_REST_Request $r) use ($public) {
            if (!lm_email_save($r['event'], $r->get_json_params() ?: [])) {
                return new WP_Error('lm_email', 'Unknown email.', ['status' => 404]);
            }
            return $public(lm_email_template($r['event']));
        },
    ]);

    register_rest_route($ns, '/emails/(?P<event>[a-z_]+)/reset', [
        'methods' => 'POST',
        'permission_callback' => $admin,
        'callback' => function (WP_REST_Request $r) use ($public) {
            $saved = get_option('lm_email_templates', []);
            unset($saved[$r['event']]);
            update_option('lm_email_templates', $saved, false);
            $t = lm_email_template($r['event']);
            return $t ? $public($t) : new WP_Error('lm_email', 'Unknown email.', ['status' => 404]);
        },
    ]);

    // Preview and test use the draft being edited, filled with sample data.
    $draft = function (WP_REST_Request $r) {
        $event = (string) $r->get_param('event');
        $t = lm_email_template($event);
        if (!$t) {
            return null;
        }
        foreach (['subject', 'heading', 'body', 'button', 'link', 'footnote'] as $f) {
            $v = $r->get_param($f);
            if ($v !== null && !in_array($f, $t['locked'] ?? [], true)) {
                $t[$f] = in_array($f, ['body', 'footnote'], true) ? sanitize_textarea_field((string) $v) : sanitize_text_field((string) $v);
            }
        }
        return $t;
    };

    register_rest_route($ns, '/emails-preview', [
        'methods' => 'POST',
        'permission_callback' => $admin,
        'callback' => function (WP_REST_Request $r) use ($draft) {
            $t = $draft($r);
            if (!$t) {
                return new WP_Error('lm_email', 'Unknown email.', ['status' => 404]);
            }
            $u = wp_get_current_user();
            return lm_email_render($t, lm_email_sample_ctx($t['event'], $u));
        },
    ]);

    register_rest_route($ns, '/emails-test', [
        'methods' => 'POST',
        'permission_callback' => $admin,
        'callback' => function (WP_REST_Request $r) use ($draft) {
            $ok = lm_throttle('email_test', 20, 3600);
            if (is_wp_error($ok)) {
                return $ok;
            }
            $t = $draft($r);
            if (!$t) {
                return new WP_Error('lm_email', 'Unknown email.', ['status' => 404]);
            }
            $u = wp_get_current_user();
            $mail = lm_email_render($t, lm_email_sample_ctx($t['event'], $u));
            $sent = lm_mail($u->user_email, '[Test] ' . $mail['subject'], $mail['html']);
            lm_email_log($t['event'], null, $u->ID, $u->user_email, '[Test] ' . $mail['subject'], $sent ? 'test' : 'failed');
            return $sent ? ['sent' => true, 'to' => $u->user_email] : new WP_Error('lm_mail', 'The server could not send the email.', ['status' => 500]);
        },
    ]);

    register_rest_route($ns, '/emails-log', [
        'methods' => 'GET',
        'permission_callback' => $admin,
        'callback' => function (WP_REST_Request $r) {
            global $wpdb;
            $event = sanitize_key((string) $r->get_param('event'));
            $sql = 'SELECT event, toEmail, subject, status, createdOn FROM ' . $wpdb->prefix . 'lm_email_log';
            $rows = $event
                ? $wpdb->get_results($wpdb->prepare("$sql WHERE event = %s ORDER BY Id DESC LIMIT 50", $event), ARRAY_A)
                : $wpdb->get_results("$sql ORDER BY Id DESC LIMIT 100", ARRAY_A);
            foreach ($rows as &$row) {
                $row['createdOn'] = gmdate('Y-m-d\TH:i:s\Z', strtotime($row['createdOn'] . ' UTC'));
            }
            return ['log' => $rows];
        },
    ]);
}


/** The words for a proposal's category, community and contact preference, shared by the proposal emails. */
function lm_proposal_email_ctx($p)
{
    $labels = ['Health' => 'Health checkups', 'Cleaning' => 'Deep cleaning', 'Solar' => 'Rooftop solar', 'Products' => 'Local products', 'Pest' => 'Pest control', 'AC' => 'AC care'];
    $cat = $p['category_c'] === 'Other' ? trim((string) $p['newCategory_c']) . ' (new category)' : ($labels[$p['category_c']] ?? (string) $p['category_c']);
    if ($p['community_c']) {
        $c = lm_row('communities_c', (int) $p['community_c']);
        $community = $c['Name'] ?? 'Unknown';
    } else {
        $community = trim((string) $p['newCommunity_c']) . ($p['newLocality_c'] ? ', ' . trim((string) $p['newLocality_c']) : '') . ' (not on Lotmates yet)';
    }
    $phone = trim((string) $p['contactPhone_c']);
    $email = trim((string) $p['contactEmail_c']);
    return [
        'proposal_name' => (string) $p['Name'],
        'category' => $cat,
        'community' => $community,
        'homes' => $p['homesInterested_c'] ? (string) $p['homesInterested_c'] : 'Not given',
        'proposal_link' => LM_SITE_URL . '/proposals/' . (int) $p['Id'],
        'site_link' => LM_SITE_URL,
        // Used inside sentences: "We'll reach you by phone at ..." and on the team's list.
        'contact' => $p['contactPref_c'] === 'Phone' && $phone ? "by phone at $phone" : ($email ? "by email at $email" : 'by email'),
    ];
}

function lm_email_proposal_change($id, $before, $after)
{
    $owner = get_user_by('id', (int) $after['Owner']);
    if (!$owner) {
        return;
    }
    $ctx = lm_proposal_email_ctx($after);

    if (!$before) {
        if (user_can($owner, 'manage_options') || lm_profile_of($owner) === 'Admin_c') {
            return; // The team proposing to itself needs no emails.
        }
        $name = trim($owner->first_name . ' ' . $owner->last_name) ?: $owner->user_email;
        foreach (lm_team_recipients() as $to) {
            lm_send_template('t_new_proposal', $to, $ctx + [
                'proposer_name' => $name,
                'notes' => $after['notes_c'] ? 'Notes: ' . $after['notes_c'] : '',
                'contact' => ucfirst(preg_replace('/^by /', '', $ctx['contact'])),
            ], ['ref' => $id]);
        }
        lm_send_template('a_proposal_received', $owner->user_email, lm_email_ctx_user($owner) + $ctx, ['ref' => $id, 'user' => $owner->ID, 'once' => true]);
        return;
    }

    // Only the team's replies notify the ambassador, not the ambassador's own edits.
    $me = wp_get_current_user();
    if (!$me || !$me->ID || (int) $me->ID === (int) $owner->ID || !lm_is_admin($me)) {
        return;
    }
    $status_changed = $after['status_c'] !== $before['status_c'];
    $note_changed = (string) $after['adminNote_c'] !== (string) $before['adminNote_c'];
    if (!$status_changed && !$note_changed) {
        return;
    }
    $lines = [
        'New' => 'Your proposal is back in the queue. The team will pick it up again soon.',
        'Reviewing' => 'The team is looking into your proposal and talking to vendors about it.',
        'Accepted' => 'Good news: the team is going ahead with your proposal and will set up the deal. We\'ll let you know when it opens.',
        'Declined' => 'The team isn\'t taking this proposal forward this time.',
    ];
    $status = (string) $after['status_c'];
    $line = $status_changed ? ($lines[$status] ?? 'The team updated your proposal.') : 'The team added a note to your proposal.';
    lm_send_template('a_proposal_update', $owner->user_email, lm_email_ctx_user($owner) + $ctx + [
        'status' => ['New' => 'back in the queue', 'Reviewing' => 'under review', 'Accepted' => 'accepted', 'Declined' => 'declined'][$status] ?? strtolower($status),
        'status_line' => $line,
        'team_note' => $after['adminNote_c'] ? "Note from the team:\n" . $after['adminNote_c'] : '',
    ], ['ref' => $id, 'user' => $owner->ID]);
}
