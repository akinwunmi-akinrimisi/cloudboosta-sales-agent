# Twilio → Retell AI SIP Trunk Setup Guide
## International Calling (Nigeria, Ghana & Worldwide)

**Purpose:** Import your existing Twilio number into Retell AI via Elastic SIP Trunking so your John sales agent can call any international number — including Nigeria (+234) and Ghana (+233).

**Architecture:**
```
Retell AI (John Agent) → SIP → Twilio Elastic SIP Trunk → PSTN → Nigerian/Ghanaian Number
```

---

## Prerequisites

- Active Twilio account (upgraded, not trial)
- Active Retell AI account with agent created
- At least one phone number purchased on Twilio
- Your Retell API key (Dashboard → Settings → API Keys)
- Your Retell Agent ID (Dashboard → Agents → Select Agent → Copy Agent ID)

---

## PHASE 1: Twilio Console Configuration (Manual — One-Time Setup)

### Step 1.1: Create Elastic SIP Trunk

1. Log into **Twilio Console** → [console.twilio.com](https://console.twilio.com)
2. Navigate to **Elastic SIP Trunking** → **Trunks**
3. Click **Create new SIP Trunk**
4. Give it a name: `retell-international-trunk`
5. Under **General Settings**, toggle on:
   - **Call Recording** (optional, if you want Twilio-side recording)
   - **Secure Trunking** (recommended)

### Step 1.2: Configure Termination (Outbound Calls)

This is what allows Retell to send outbound calls through Twilio.

1. In your trunk, go to the **Termination** tab
2. Set the **Termination SIP URI** — this will look like:
   ```
   your-trunk-name.pstn.twilio.com
   ```
   > **Important:** Use a localized termination URI near your region for lower latency. Twilio provides regional URIs — expand "View localized URIs" in the console to find one near you. For Europe/Africa, consider the London or Frankfurt URI.

3. **Authentication** — Choose ONE method:

   **Option A: IP Access Control List (Recommended)**
   - Click **IP Access Control Lists** under Termination
   - Create a new ACL, name it `retell-sip-acl`
   - Add Retell's SIP SBC CIDR block:
     ```
     18.98.16.120/30
     ```
   - This whitelists Retell's servers so they can send calls through your trunk

   **Option B: Credential-Based Auth**
   - Go to **Authentication** → **Credential Lists**
   - Create a new credential list, name it `retell-credentials`
   - Add a username and password (save these — you'll need them in Phase 2)
   - Example:
     ```
     Username: retell_sip_user
     Password: <generate a strong password>
     ```

### Step 1.3: Configure Origination (Inbound Calls)

This allows inbound calls to your Twilio number to be routed to Retell's AI agent.

1. In your trunk, go to the **Origination** tab
2. Click **Add new Origination URI**
3. Enter Retell's SIP server:
   ```
   sip:sip.retellai.com
   ```
4. Set **Priority** to `10` and **Weight** to `10`
5. Click **Add**

### Step 1.4: Move Your Twilio Number to the SIP Trunk

1. In your trunk, go to the **Numbers** tab
2. Click **Add an Existing Number**
3. Select the Twilio number you want to use (e.g., `+1415XXXXXXX`)
4. Click **Add Selected**

> Your number is now attached to the Elastic SIP Trunk instead of Twilio's default Programmable Voice. Both inbound and outbound calls will route through the trunk.

### Step 1.5: Enable International Geographic Permissions

**This is the critical step that unlocks Nigeria, Ghana, and other countries.**

1. In Twilio Console, search for **"geo"** in the search bar
2. Click **Voice Geographic Permissions**
3. In the selector at the top, choose **"Elastic SIP Trunking"** (not "Programmable Voice")
4. Find and enable these countries:
   - **Nigeria** (+234)
   - **Ghana** (+233)
   - Any other countries you want to call (UK, Kenya, South Africa, etc.)
5. Click **Save**

> Without this step, outbound calls to Nigeria/Ghana will silently fail.

### Step 1.6 (Optional): Set Caller ID Masking

If you want recipients to see a specific caller ID (e.g., your business number):

1. Go to **Phone Numbers** → **Manage** → **Verified Caller IDs**
2. Click **Add a new Caller ID**
3. Enter the number you want displayed, verify via OTP
4. Return to your SIP Trunk → **Termination** tab
5. Scroll to **Header Manipulation** → **View all SIP header manipulation policies**
6. Create a new policy:
   - Name: `retell-caller-id`
   - Add request rule:
     - **SIP header field:** `From number`
     - **Action:** `Replace with`
     - **Value:** Your verified caller ID in E.164 (e.g., `+18881230987`)
7. Save the policy
8. Back on the Termination tab, select the policy from the dropdown

---

## PHASE 2: Import Number into Retell AI via API

Now that Twilio is configured, import the number into Retell so the AI agent can use it.

### Step 2.1: Import Phone Number (API Call)

**If you used IP ACL authentication (Option A in Step 1.2):**

```bash
curl -X POST "https://api.retellai.com/import-phone-number" \
  -H "Authorization: Bearer YOUR_RETELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+1415XXXXXXX",
    "termination_uri": "your-trunk-name.pstn.twilio.com",
    "nickname": "John International Outbound",
    "inbound_agents": [
      {
        "agent_id": "YOUR_AGENT_ID",
        "weight": 1
      }
    ],
    "outbound_agents": [
      {
        "agent_id": "YOUR_AGENT_ID",
        "weight": 1
      }
    ],
    "allowed_outbound_country_list": ["US", "CA", "GB", "NG", "GH", "KE", "ZA"],
    "inbound_webhook_url": "https://your-n8n-instance.com/webhook/retell-inbound"
  }'
```

**If you used credential-based auth (Option B in Step 1.2):**

```bash
curl -X POST "https://api.retellai.com/import-phone-number" \
  -H "Authorization: Bearer YOUR_RETELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+1415XXXXXXX",
    "termination_uri": "your-trunk-name.pstn.twilio.com",
    "sip_trunk_auth_username": "retell_sip_user",
    "sip_trunk_auth_password": "YOUR_SIP_PASSWORD",
    "nickname": "John International Outbound",
    "inbound_agents": [
      {
        "agent_id": "YOUR_AGENT_ID",
        "weight": 1
      }
    ],
    "outbound_agents": [
      {
        "agent_id": "YOUR_AGENT_ID",
        "weight": 1
      }
    ],
    "allowed_outbound_country_list": ["US", "CA", "GB", "NG", "GH", "KE", "ZA"],
    "inbound_webhook_url": "https://your-n8n-instance.com/webhook/retell-inbound"
  }'
```

**Using the Retell SDK (Node.js):**

```javascript
import Retell from 'retell-sdk';

const client = new Retell({
  apiKey: 'YOUR_RETELL_API_KEY',
});

const phoneNumber = await client.phoneNumber.import({
  phone_number: '+1415XXXXXXX',
  termination_uri: 'your-trunk-name.pstn.twilio.com',
  // Include these if using credential auth:
  // sip_trunk_auth_username: 'retell_sip_user',
  // sip_trunk_auth_password: 'YOUR_SIP_PASSWORD',
  nickname: 'John International Outbound',
  inbound_agents: [
    { agent_id: 'YOUR_AGENT_ID', weight: 1 }
  ],
  outbound_agents: [
    { agent_id: 'YOUR_AGENT_ID', weight: 1 }
  ],
  allowed_outbound_country_list: ['US', 'CA', 'GB', 'NG', 'GH', 'KE', 'ZA'],
  inbound_webhook_url: 'https://your-n8n-instance.com/webhook/retell-inbound',
});

console.log('Imported:', phoneNumber.phone_number);
console.log('Type:', phoneNumber.phone_number_type);
```

**Expected Response (201):**
```json
{
  "phone_number": "+1415XXXXXXX",
  "phone_number_type": "custom",
  "nickname": "John International Outbound",
  "sip_outbound_trunk_config": {
    "termination_uri": "your-trunk-name.pstn.twilio.com",
    "auth_username": "retell_sip_user",
    "transport": "TCP"
  },
  "inbound_agents": [
    { "agent_id": "YOUR_AGENT_ID", "weight": 1 }
  ],
  "outbound_agents": [
    { "agent_id": "YOUR_AGENT_ID", "weight": 1 }
  ],
  "allowed_outbound_country_list": ["US", "CA", "GB", "NG", "GH", "KE", "ZA"]
}
```

### Step 2.2: Verify the Import

```bash
curl -X GET "https://api.retellai.com/get-phone-number/+1415XXXXXXX" \
  -H "Authorization: Bearer YOUR_RETELL_API_KEY"
```

Or list all numbers:
```bash
curl -X GET "https://api.retellai.com/list-phone-numbers" \
  -H "Authorization: Bearer YOUR_RETELL_API_KEY"
```

---

## PHASE 3: Make Outbound Calls to Nigeria/Ghana

### Step 3.1: Create a Phone Call via API

```bash
curl -X POST "https://api.retellai.com/v2/create-phone-call" \
  -H "Authorization: Bearer YOUR_RETELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from_number": "+1415XXXXXXX",
    "to_number": "+2348012345678",
    "override_agent_id": "YOUR_AGENT_ID",
    "retell_llm_dynamic_variables": {
      "customer_name": "Adebayo Ogunlesi",
      "company": "Cloudboosta",
      "course": "AWS SAA-C03"
    }
  }'
```

**Using the Retell SDK:**

```javascript
const call = await client.call.createPhoneCall({
  from_number: '+1415XXXXXXX',
  to_number: '+2348012345678',        // Nigerian number
  override_agent_id: 'YOUR_AGENT_ID',
  retell_llm_dynamic_variables: {
    customer_name: 'Adebayo Ogunlesi',
    company: 'Cloudboosta',
    course: 'AWS SAA-C03',
  },
});

console.log('Call ID:', call.call_id);
console.log('Status:', call.call_status);
```

**For Ghana:**
```javascript
const call = await client.call.createPhoneCall({
  from_number: '+1415XXXXXXX',
  to_number: '+233201234567',          // Ghanaian number
  override_agent_id: 'YOUR_AGENT_ID',
  retell_llm_dynamic_variables: {
    customer_name: 'Kwame Mensah',
    company: 'Cloudboosta',
    course: 'AWS SAA-C03',
  },
});
```

### Step 3.2: Batch Calls (Scale Outreach)

```bash
curl -X POST "https://api.retellai.com/create-batch-call" \
  -H "Authorization: Bearer YOUR_RETELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from_number": "+1415XXXXXXX",
    "tasks": [
      {
        "to_number": "+2348012345678",
        "retell_llm_dynamic_variables": {
          "customer_name": "Adebayo Ogunlesi",
          "course": "AWS SAA-C03"
        }
      },
      {
        "to_number": "+2348098765432",
        "retell_llm_dynamic_variables": {
          "customer_name": "Chidinma Eze",
          "course": "AWS SAA-C03"
        }
      },
      {
        "to_number": "+233201234567",
        "retell_llm_dynamic_variables": {
          "customer_name": "Kwame Mensah",
          "course": "AWS SAA-C03"
        }
      }
    ]
  }'
```

---

## PHASE 4: n8n Workflow Integration

### Step 4.1: Outbound Call Trigger (n8n → Retell)

Use an **HTTP Request** node in n8n to trigger calls:

```json
{
  "method": "POST",
  "url": "https://api.retellai.com/v2/create-phone-call",
  "headers": {
    "Authorization": "Bearer {{ $credentials.retellApi.apiKey }}",
    "Content-Type": "application/json"
  },
  "body": {
    "from_number": "+1415XXXXXXX",
    "to_number": "{{ $json.phone_number }}",
    "override_agent_id": "YOUR_AGENT_ID",
    "retell_llm_dynamic_variables": {
      "customer_name": "{{ $json.first_name }} {{ $json.last_name }}",
      "company": "Cloudboosta",
      "course": "{{ $json.interested_course }}"
    }
  }
}
```

### Step 4.2: Inbound Webhook Handler (Retell → n8n)

When you set `inbound_webhook_url` during import, Retell sends a POST to your n8n webhook for every inbound call. Your n8n webhook should return:

```json
{
  "agent_id": "YOUR_AGENT_ID",
  "retell_llm_dynamic_variables": {
    "caller_number": "{{ $json.from_number }}",
    "call_type": "inbound"
  }
}
```

### Step 4.3: Post-Call Webhook (Retell → n8n → Supabase)

Register a general webhook in Retell Dashboard → Settings → Webhooks:
- URL: `https://your-n8n-instance.com/webhook/retell-post-call`
- Events: `call_ended`, `call_analyzed`

n8n receives the payload and logs to Supabase:
```json
{
  "call_id": "...",
  "from_number": "+1415XXXXXXX",
  "to_number": "+2348012345678",
  "duration_ms": 180000,
  "transcript": "...",
  "call_analysis": {
    "sentiment": "positive",
    "outcome": "booked_demo"
  }
}
```

---

## Cost Breakdown

| Destination | Twilio Rate/Min | Retell Agent/Min | Total/Min (est.) |
|---|---|---|---|
| Nigeria (Mobile) | ~$0.36–0.48 | Retell standard rate | ~$0.50–0.65 |
| Nigeria (Landline) | ~$0.08–0.12 | Retell standard rate | ~$0.22–0.28 |
| Ghana (Mobile) | ~$0.30–0.40 | Retell standard rate | ~$0.45–0.55 |
| Ghana (Landline) | ~$0.08–0.12 | Retell standard rate | ~$0.22–0.28 |
| US | ~$0.015 | Retell standard rate | ~$0.13–0.15 |
| UK | ~$0.04 | Retell standard rate | ~$0.18–0.20 |

> **Note:** Twilio rates vary. Check [twilio.com/voice/pricing](https://www.twilio.com/voice/pricing) for exact current rates per destination. Retell's agent processing fee is separate and based on your plan.

---

## Troubleshooting

### Outbound calls to Nigeria fail silently
- **Check:** Twilio Geo Permissions → Make sure "Elastic SIP Trunking" is selected (not "Programmable Voice") and Nigeria is enabled
- **Check:** Your trunk termination URI has no trailing spaces
- **Check:** The number is moved to the SIP trunk (not still on Programmable Voice)

### Inbound works but outbound doesn't
- **Check:** Termination URI is correct and localized to your region
- **Check:** If using credential auth, verify the username (not the friendly name) and password match exactly what you entered in Retell
- **Check:** If using IP ACL, confirm `18.98.16.120/30` is whitelisted

### "Number not found" when calling Retell API
- **Check:** Number format is E.164 (e.g., `+1415XXXXXXX` not `1415XXXXXXX`)
- **Check:** The number was successfully imported (verify with GET endpoint)

### Call connects but no audio
- **Check:** Origination URI is `sip:sip.retellai.com`
- **Check:** Transport protocol matches (default is TCP)

### Nigerian recipients see "Unknown" or "Spam"
- This is expected when calling from a US number to Nigeria — local carriers may flag foreign numbers
- **Workaround:** Set up caller ID masking (Phase 1, Step 1.6) with a recognizable number
- **Better solution:** Use KrosAI for a local +234 caller ID (separate setup)

---

## Quick Reference — Values You Need

| Item | Where to Find It |
|---|---|
| Retell API Key | Retell Dashboard → Settings → API Keys |
| John Agent ID | Retell Dashboard → Agents → Select John → Agent ID |
| Twilio Termination URI | Twilio Console → Elastic SIP Trunking → Your Trunk → Termination tab |
| Twilio SIP Auth Credentials | Twilio Console → Elastic SIP Trunking → Your Trunk → Termination → Authentication |
| Retell SIP CIDR (for ACL) | `18.98.16.120/30` |
| Retell Origination URI | `sip:sip.retellai.com` |
| n8n Webhook Base URL | Your Hostinger VPS n8n instance URL |

---

*Last updated: March 29, 2026*
