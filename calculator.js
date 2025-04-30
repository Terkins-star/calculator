document.addEventListener('DOMContentLoaded', () => {
    const roleProfilesContainer = document.getElementById('role-profiles-container');
    const addRoleBtn = document.getElementById('add-role-btn');
    const calculateBtn = document.getElementById('calculate-btn');
    const resultDiv = document.getElementById('result');
    const companyStageSelect = document.getElementById('company-stage');
    const compensationStrategySelect = document.getElementById('compensation-strategy');
    const automationToolsSelect = document.getElementById('automation-tools');
    const recruitingModelSelect = document.getElementById('recruiting-model');
    const hiringBarSelect = document.getElementById('hiring-bar');

    const BASE_EFFORT_PER_HIRE = 25; // hours
    const MONTHLY_RECRUITER_CAPACITY = 128; // hours
    const TIME_PER_CV_REVIEW = 0.02; // hours (1.2 minutes)
    const SOURCING_EFFORT_CV_REVIEW_PERCENTAGE = 0.40; // Assumption: 40% of sourcing block is CV review
    let roleProfileCount = 0;

    const multipliers = {
        roleType: {
            gtm: 1.0,
            ops: 0.9,
            eng: 1.4,
            spec: 1.7
        },
        seniority: {
            junior: 0.8,
            mid: 1.0,
            senior: 1.4,
            lead: 1.8,
            princ: 2.2,
            exec: 2.5
        },
        location: {
            remote_tz: 1.0,
            remote_global: 1.1,
            hybrid: 1.2,
            country: 1.3,
            city: 1.5
        },
        companyStage: {
            growth: 1.0,
            early: 1.3,
            enterprise: 1.1
        },
        compensation: {
            '90plus': 0.8,
            '75to90': 1.0,
            '50to75': 1.3,
            'below50': 1.6
        },
        hiringBar: {
            market: 1.0,
            high: 1.2,
            very_high: 1.6,
            exceptional: 2.2
        }
    };

    function addRoleProfile() {
        roleProfileCount++;
        const profileDiv = document.createElement('div');
        profileDiv.classList.add('role-profile');
        profileDiv.setAttribute('id', `role-profile-${roleProfileCount}`);
        profileDiv.innerHTML = `
            <h3>Role Profile ${roleProfileCount} <button type="button" class="remove-role-btn">Remove</button></h3>
            <label for="hires-${roleProfileCount}">Monthly Hires Needed:</label>
            <input type="number" id="hires-${roleProfileCount}" value="1" min="0">

            <label for="role-type-${roleProfileCount}">Role Type:</label>
            <select id="role-type-${roleProfileCount}">
                <option value="gtm">GTM (Sales, Marketing, CS)</option>
                <option value="ops">Ops / Support / Admin</option>
                <option value="eng">Engineering / Product / Design</option>
                <option value="spec">Specialized / Niche / Research</option>
            </select>

            <label for="seniority-${roleProfileCount}">Seniority:</label>
            <select id="seniority-${roleProfileCount}">
                <option value="junior">Junior (0-2 YoE)</option>
                <option value="mid">Mid-Level (2-5 YoE)</option>
                <option value="senior">Senior (5-8 YoE)</option>
                <option value="lead">Lead / Staff (8-12 YoE)</option>
                <option value="princ">Principal / Sr. Staff (12+ YoE)</option>
                <option value="exec">Executive (Director+)</option>
            </select>

            <label for="location-${roleProfileCount}">Location Constraints:</label>
            <select id="location-${roleProfileCount}">
                <option value="remote_tz">Remote (Timezone-constrained)</option>
                <option value="remote_global">Remote (Global)</option>
                <option value="hybrid">Hybrid (Hub Required)</option>
                <option value="country">Single Country (Non-Hub)</option>
                <option value="city">Single City / Hub</option>
            </select>
        `;

        // Add remove button functionality
        profileDiv.querySelector('.remove-role-btn').addEventListener('click', () => {
            profileDiv.remove();
            // Optional: Renumber profiles if needed, but simpler not to for now
        });

        roleProfilesContainer.appendChild(profileDiv);
    }

    function calculateFTE() {
        let totalRawMonthlyEffort = 0;
        let totalSourcingEffort = 0;
        let totalScreeningEffort = 0;
        let totalOfferEffort = 0;
        let totalCoordEffort = 0;

        const companyStageMultiplier = multipliers.companyStage[companyStageSelect.value];
        const compensationMultiplier = multipliers.compensation[compensationStrategySelect.value];
        const hiringBarMultiplier = multipliers.hiringBar[hiringBarSelect.value];

        const profiles = roleProfilesContainer.querySelectorAll('.role-profile');
        if (profiles.length === 0) {
            resultDiv.innerHTML = "Please add at least one role profile.";
            return;
        }

        profiles.forEach(profile => {
            const idSuffix = profile.id.split('-').pop(); // Get the unique ID number
            const hires = parseFloat(document.getElementById(`hires-${idSuffix}`).value) || 0;
            const roleType = document.getElementById(`role-type-${idSuffix}`).value;
            const seniority = document.getElementById(`seniority-${idSuffix}`).value;
            const location = document.getElementById(`location-${idSuffix}`).value;

            if (hires <= 0) return; // Skip profiles with no hires

            // Ensure the selected value exists in the multipliers object, default to 1 if not
            // This handles cases where a profile might have been added before options changed, though ideally UI prevents this.
            const roleMultiplier = multipliers.roleType[roleType] ?? 1.0;
            const seniorityMultiplier = multipliers.seniority[seniority] ?? 1.0;
            const locationMultiplier = multipliers.location[location] ?? 1.0;

            const adjustedEffortPerHire = BASE_EFFORT_PER_HIRE *
                                        roleMultiplier *
                                        seniorityMultiplier *
                                        locationMultiplier *
                                        companyStageMultiplier *
                                        compensationMultiplier *
                                        hiringBarMultiplier;

            const roleProfileEffort = adjustedEffortPerHire * hires;
            totalRawMonthlyEffort += roleProfileEffort;

            // Calculate effort breakdown for this profile
            totalSourcingEffort += (adjustedEffortPerHire * 0.35) * hires;
            totalScreeningEffort += (adjustedEffortPerHire * 0.40) * hires;
            totalOfferEffort += (adjustedEffortPerHire * 0.15) * hires;
            totalCoordEffort += (adjustedEffortPerHire * 0.10) * hires;
        });

        let finalTotalMonthlyEffort = totalRawMonthlyEffort;
        let finalSourcingEffort = totalSourcingEffort;
        let finalScreeningEffort = totalScreeningEffort;
        let finalOfferEffort = totalOfferEffort;
        let finalCoordEffort = totalCoordEffort;

        const automationDiscount = (automationToolsSelect.value === 'yes') ? 0.7 : 1.0;

        if (automationDiscount < 1.0) {
            finalTotalMonthlyEffort *= automationDiscount;
            finalSourcingEffort *= automationDiscount;
            finalScreeningEffort *= automationDiscount;
            finalOfferEffort *= automationDiscount;
            finalCoordEffort *= automationDiscount;
        }

        if (finalTotalMonthlyEffort <= 0) {
             resultDiv.innerHTML = "Total effort is zero. Please check hire numbers.";
             return;
        }

        const totalFTE = finalTotalMonthlyEffort / MONTHLY_RECRUITER_CAPACITY;

        // Calculate estimated CVs needed
        const cvReviewTime = finalSourcingEffort * SOURCING_EFFORT_CV_REVIEW_PERCENTAGE;
        const estimatedCVs = (TIME_PER_CV_REVIEW > 0) ? Math.round(cvReviewTime / TIME_PER_CV_REVIEW) : 0;

        // Display results
        let resultText = ``;
        const recruitingModel = recruitingModelSelect.value;

        // Add Effort Breakdown with explanations
        resultText += `<h3>Estimated Monthly Effort Breakdown:</h3>
                       <ul>
                         <li>Sourcing & CV Review: ~<strong>${finalSourcingEffort.toFixed(1)} hours</strong>
                             <br><small><em>Includes active sourcing (job boards, LinkedIn, database searches), **candidate research, crafting personalized outreach messages, initial candidate communication,** and reviewing inbound applications. Based on ${TIME_PER_CV_REVIEW * 60} mins/CV review assumption (for the review portion), requires processing approx. <strong>${estimatedCVs} CVs</strong> total at the top of the funnel.</em></small>
                         </li>
                         <li>Screening & Interviews: ~<strong>${finalScreeningEffort.toFixed(1)} hours</strong>
                             <br><small><em>Includes initial recruiter screens, coordinating and participating in interview loops, debriefs.</em></small>
                         </li>
                         <li>Offer & Closing: ~<strong>${finalOfferEffort.toFixed(1)} hours</strong>
                             <br><small><em>Includes offer preparation, negotiation, closing candidates, reference checks.</em></small>
                         </li>
                         <li>Coordination & Admin: ~<strong>${finalCoordEffort.toFixed(1)} hours</strong>
                             <br><small><em>Includes scheduling, ATS management, internal meetings related to hiring.</em></small>
                         </li>
                       </ul>
                       <hr>
                      `;

        if (recruitingModel === 'full-cycle') {
            resultText += `Estimated Requirement: <strong>${totalFTE.toFixed(1)} Full-Cycle Recruiter FTEs</strong>`;
        } else { // split model
            const sourcerFTE = totalFTE * 0.3;
            const recruiterFTE = totalFTE * 0.7;
            resultText += `Estimated Requirement: <strong>${totalFTE.toFixed(1)} Total FTEs</strong><br>
                          - Sourcer FTE: ~<strong>${sourcerFTE.toFixed(1)}</strong><br>
                          - Recruiter FTE: ~<strong>${recruiterFTE.toFixed(1)}</strong>`;
        }

        resultText += `<br><br><em>(Based on ${finalTotalMonthlyEffort.toFixed(1)} total monthly hours of effort and ${MONTHLY_RECRUITER_CAPACITY} hours/FTE capacity. Rounding up recommended.)</em>`;

        resultDiv.innerHTML = resultText;
    }

    // Initial setup
    addRoleProfile(); // Start with one profile
    resultDiv.innerHTML = "Enter hiring details and click 'Calculate FTE'.";

    // Event Listeners
    addRoleBtn.addEventListener('click', addRoleProfile);
    calculateBtn.addEventListener('click', calculateFTE);
}); 