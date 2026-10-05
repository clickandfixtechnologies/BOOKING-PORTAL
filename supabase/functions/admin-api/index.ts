import { corsHeaders, corsResponse } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";

const statuses = [
  "pending",
  "confirmed",
  "technician_assigned",
  "on_the_way",
  "in_progress",
  "job_id_created",
  "completed",
  "cancelled",
  "rescheduled",
  "no_show"
];

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }

  try {
    const { supabase, user } = await requireAdmin(request);
    const body = await request.json();

    const output = await route(
      supabase,
      user.id,
      body
    );

    return corsResponse(output);

  } catch (error) {

    const message =
      error.message === "AUTH_REQUIRED"
        ? "Sign in is required."
        : error.message === "ADMIN_REQUIRED"
        ? "Administrator access is required."
        : error.message === "ADMIN_LOOKUP_FAILED"
        ? "Administrator verification failed."
        : error.message === "TECHNICIAN_LOOKUP_FAILED"
        ? "Technician verification failed."
        : error.message || "Request failed.";

    const status =
      error.message === "AUTH_REQUIRED" ||
      error.message === "ADMIN_REQUIRED"
        ? 401
        : 400;

    return corsResponse(
      { error: message },
      status
    );
  }
});

async function route(
  db: any,
  userId: string,
  body: any
) {

  switch (body.action) {

    case "dashboard":
      return dashboard(db);

    case "appointments":
      return appointments(db, body);

    case "appointment":
      return detail(db, body.id);

    case "update_appointment":
      return updateAppointment(
        db,
        userId,
        body
      );

    case "reschedule_appointment":
      return rescheduleAppointment(
        db,
        userId,
        body
      );

    case "availability":
      return availability(db);

    case "save_availability":
      return saveAvailability(
        db,
        body.settings
      );

    case "save_block":
      return saveBlock(
        db,
        body.block
      );

    case "delete_block":
      return deleteBlock(
        db,
        body.id
      );

    case "technicians":
      return technicians(db);

    case "create_technician":
      return createTechnician(
        db,
        body.technician
      );

    case "update_technician":
      return updateTechnician(
        db,
        body.technician
      );

    case "toggle_technician_status":
      return toggleTechnicianStatus(
        db,
        body
      );

    case "delete_technician":
      return deleteTechnician(
        db,
        body.id
      );

    case "notifications":
      return notifications(
        db,
        userId
      );

    case "notification_logs":
      return notificationLogs(db);

    case "mark_notification_read":
      return markRead(
        db,
        userId,
        body.id
      );

    case "support_requests":
      return supportRequests(
        db,
        body
      );

    case "support_get_request":
      return supportGetRequest(
        db,
        body
      );

    case "support_messages":
      return supportMessages(
        db,
        body
      );

    case "support_message_send":
      return sendSupportMessage(
        db,
        userId,
        body
      );

      /* =====================================================
   DIRECT SUPPORT CHAT
   ===================================================== */

case "direct_support_conversations":
  return directSupportConversations(
    db
  );

case "direct_support_messages":
  return directSupportMessages(
    db,
    body
  );

case "direct_support_message_send":
  return sendDirectSupportMessage(
    db,
    userId,
    body
  );

    case "support_status_update":
      return updateSupportStatus(
        db,
        userId,
        body
      );

    case "delete_appointment":
      return deleteAppointment(
        db,
        body.id
      );

    default:
      throw new Error("Unknown admin action.");
  }
}


/* =========================================================
   DASHBOARD
   ========================================================= */

async function dashboard(db: any) {

  const today =
    new Date().toLocaleDateString(
      "en-CA"
    );

  const [
    { data: rows, error },
    { count: todays }
  ] = await Promise.all([

    db
      .from("appointments")
      .select("status"),

    db
      .from("appointments")
      .select("id", {
        count: "exact",
        head: true
      })
      .eq(
        "appointment_date",
        today
      )

  ]);

  if (error) {
    throw error;
  }

  const counts =
    Object.fromEntries(
      statuses.map((status) => [
        status,
        0
      ])
    );

  (rows || []).forEach(
    (row: any) => {
      counts[row.status]++;
    }
  );

  return {
    today: todays || 0,
    counts
  };
}


/* =========================================================
   APPOINTMENTS
   ========================================================= */

async function appointments(
  db: any,
  body: any
) {

  let query =
    db
      .from("appointments")
      .select(
        `
        id,
        appointment_id,
        appointment_code,
        customer_name,
        mobile,
        email,
        service_category,
        service_type,
        service_location_type,
        service_address,
        landmark,
        latitude,
        longitude,
        google_maps_url,
        appointment_date,
        appointment_time,
        status,
        job_code,
        technician_id,
        technicians(full_name)
        `,
        {
          count: "exact"
        }
      )
      .order(
        "appointment_date"
      )
      .order(
        "appointment_time"
      );

  const filters =
    body.filters || {};

  if (filters.date) {
    query = query.eq(
      "appointment_date",
      filters.date
    );
  }

  if (filters.status) {
    query = query.eq(
      "status",
      filters.status
    );
  }

  if (filters.service) {
    query = query.eq(
      "service_category",
      filters.service
    );
  }

  if (filters.technician) {
    query = query.eq(
      "technician_id",
      filters.technician
    );
  }

  if (filters.search) {

    const value =
      String(
        filters.search
      ).trim();

    query = query.or(
      `appointment_id.ilike.%${value}%,appointment_code.eq.${value},customer_name.ilike.%${value}%,mobile.ilike.%${value}%`
    );
  }

  const offset =
    Math.max(
      0,
      Number(body.offset) || 0
    );

  const {
    data,
    error,
    count
  } = await query.range(
    offset,
    offset + 49
  );

  if (error) {
    throw error;
  }

  return {
    appointments: data || [],
    count: count || 0
  };
}


/* =========================================================
   APPOINTMENT DETAIL
   ========================================================= */

async function detail(
  db: any,
  id: string
) {

  const {
    data,
    error
  } = await db
    .from("appointments")
    .select(
      `
      *,
      technicians(
        id,
        full_name,
        technician_code
      ),
      appointment_status_history(
        old_status,
        new_status,
        changed_at,
        note,
        changed_by
      ),
      appointment_reschedule_history(
        old_date,
        old_time,
        new_date,
        new_time,
        reason,
        created_at
      )
      `
    )
    .eq(
      "id",
      id
    )
    .single();

  if (error) {
    throw new Error(
      "Appointment not found."
    );
  }

  const paths =
    Array.isArray(
      data.photo_references
    )
      ? data.photo_references
      : [];

  const {
    data: urls,
    error: urlError
  } = paths.length
    ? await db.storage
        .from("appointment-photos")
        .createSignedUrls(
          paths,
          3600
        )
    : {
        data: [],
        error: null
      };

  if (urlError) {
    throw new Error(
      "Appointment photos could not be loaded."
    );
  }

  return {
    appointment: {
      ...data,
      photo_urls:
        (urls || [])
          .filter(
            (item: any) =>
              item.signedUrl
          )
          .map(
            (item: any) =>
              item.signedUrl
          )
    }
  };
}


/* =========================================================
   APPOINTMENT UPDATE
   ========================================================= */

async function updateAppointment(
  db: any,
  userId: string,
  body: any
) {

  if (
    !statuses.includes(
      body.status
    )
  ) {
    throw new Error(
      "Invalid status."
    );
  }

  if (
    body.status ===
      "job_id_created" &&
    !/^CFX-JOB-\d{4}-\d{5}$/.test(
      body.job_code || ""
    )
  ) {
    throw new Error(
      "Enter a valid Job ID before activating Job ID Created."
    );
  }

  const {
    data,
    error
  } = await db.rpc(
    "admin_update_appointment",
    {
      appointment_uuid:
        body.id,

      new_status:
        body.status,

      actor:
        userId,

      note_input:
        clean(
          body.note,
          1000
        ),

      technician_uuid:
        body.technician_id ||
        null,

      job_code_input:
        body.job_code ||
        null
    }
  );

  if (error) {
    throw new Error(
      error.message
    );
  }

  return {
    appointment: data
  };
}


/* =========================================================
   RESCHEDULE
   ========================================================= */

async function rescheduleAppointment(
  db: any,
  userId: string,
  body: any
) {

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      body.date || ""
    ) ||
    !/^\d{2}:\d{2}$/.test(
      body.time || ""
    )
  ) {
    throw new Error(
      "Enter a valid date and time."
    );
  }

  const {
    data,
    error
  } = await db.rpc(
    "admin_reschedule_appointment",
    {
      appointment_uuid:
        body.id,

      new_date_input:
        body.date,

      new_time_input:
        body.time,

      actor:
        userId,

      reason_input:
        clean(
          body.reason,
          500
        )
    }
  );

  if (error) {
    throw new Error(
      error.message
    );
  }

  return {
    appointment: data
  };
}


/* =========================================================
   AVAILABILITY
   ========================================================= */

async function availability(
  db: any
) {

  const [
    {
      data: settings,
      error
    },
    {
      data: blocks,
      error: blocksError
    }
  ] = await Promise.all([

    db
      .from("business_availability")
      .select("*")
      .eq("id", true)
      .single(),

    db
      .from("availability_blocks")
      .select("*")
      .order(
        "block_date"
      )

  ]);

  if (
    error ||
    blocksError
  ) {
    throw (
      error ||
      blocksError
    );
  }

  return {
    settings,
    blocks
  };
}


/* =========================================================
   SAVE AVAILABILITY
   ========================================================= */

async function saveAvailability(
  db: any,
  input: any
) {

  const settings = {
    id: true,

    business_days:
      input.business_days,

    opening_time:
      input.opening_time,

    closing_time:
      input.closing_time,

    slot_duration_minutes:
      Number(
        input.slot_duration_minutes
      ),

    buffer_minutes:
      Number(
        input.buffer_minutes
      ),

    max_appointments_per_slot:
      Number(
        input.max_appointments_per_slot
      ),

    minimum_advance_minutes:
      Number(
        input.minimum_advance_minutes
      ),

    maximum_future_days:
      Number(
        input.maximum_future_days
      ),

    updated_at:
      new Date().toISOString()
  };

  if (
    !Array.isArray(
      settings.business_days
    ) ||
    settings.business_days.some(
      (day: any) =>
        !Number.isInteger(day) ||
        day < 1 ||
        day > 7
    )
  ) {
    throw new Error(
      "Invalid business days."
    );
  }

  const {
    data,
    error
  } = await db
    .from("business_availability")
    .upsert(settings)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return {
    settings: data
  };
}


/* =========================================================
   AVAILABILITY BLOCK
   ========================================================= */

async function saveBlock(
  db: any,
  block: any
) {

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      block.block_date || ""
    )
  ) {
    throw new Error(
      "A valid blocked date is required."
    );
  }

  const {
    data,
    error
  } = await db
    .from("availability_blocks")
    .upsert({
      id:
        block.id ||
        undefined,

      block_date:
        block.block_date,

      starts_at:
        block.starts_at ||
        null,

      ends_at:
        block.ends_at ||
        null,

      reason:
        clean(
          block.reason,
          300
        )
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return {
    block: data
  };
}


/* =========================================================
   DELETE BLOCK
   ========================================================= */

async function deleteBlock(
  db: any,
  id: string
) {

  if (
    !/^[0-9a-f-]{36}$/i.test(
      id || ""
    )
  ) {
    throw new Error(
      "Invalid blocked date."
    );
  }

  const {
    error
  } = await db
    .from("availability_blocks")
    .delete()
    .eq(
      "id",
      id
    );

  if (error) {
    throw error;
  }

  return {
    ok: true
  };
}


/* =========================================================
   TECHNICIANS
   ========================================================= */

async function technicians(
  db: any
) {

  const {
    data,
    error
  } = await db
    .from("technicians")
    .select("*")
    .order(
      "full_name"
    );

  if (error) {
    throw error;
  }

  const techniciansWithLoginEmail =
    await Promise.all(
      (data || []).map(
        async (
          technician: any
        ) => {

          let login_email =
            null;

          if (
            technician.auth_user_id
          ) {

            const {
              data: authData,
              error: authError
            } =
              await db.auth.admin
                .getUserById(
                  technician.auth_user_id
                );

            if (
              !authError &&
              authData?.user
            ) {
              login_email =
                authData.user.email ||
                null;
            }
          }

          return {
            ...technician,
            login_email
          };
        }
      )
    );

  return {
    technicians:
      techniciansWithLoginEmail
  };
}


/* =========================================================
   CREATE TECHNICIAN
   ========================================================= */

async function createTechnician(
  db: any,
  input: any
) {

  if (
    !input ||
    !/^CFX-TECH-\d{4}-\d{4,6}$/.test(
      input.technician_code || ""
    ) ||
    !/^[6-9]\d{9}$/.test(
      String(
        input.mobile || ""
      ).replace(
        /\D/g,
        ""
      )
    )
  ) {
    throw new Error(
      "Technician ID and mobile must be valid."
    );
  }

  const email =
    clean(
      input.email,
      254
    );

  const password =
    String(
      input.password || ""
    );

  if (
    !email ||
    !password
  ) {
    throw new Error(
      "A technician login email and password are required."
    );
  }

  if (
    password.length < 6
  ) {
    throw new Error(
      "Technician password must contain at least 6 characters."
    );
  }

  const {
    data: authData,
    error: authError
  } =
    await db.auth.admin
      .createUser({
        email,
        password,
        email_confirm:
          true
      });

  if (authError) {
    throw new Error(
      authError.message
    );
  }

  const {
    data,
    error
  } =
    await db
      .from("technicians")
      .insert({
        auth_user_id:
          authData.user.id,

        technician_code:
          input.technician_code,

        full_name:
          clean(
            input.full_name,
            120
          ),

        mobile:
          String(
            input.mobile
          ).replace(
            /\D/g,
            ""
          ),

        username:
          clean(
            input.username,
            80
          ),

        specialization:
          Array.isArray(
            input.specialization
          )
            ? input.specialization.slice(
                0,
                10
              )
            : [],

        working_days:
          input.working_days ||
          [1, 2, 3, 4, 5, 6],

        working_start:
          input.working_start ||
          "10:00",

        working_end:
          input.working_end ||
          "19:00",

        is_active:
          input.is_active !== false
      })
      .select()
      .single();

  if (error) {

    await db.auth.admin
      .deleteUser(
        authData.user.id
      );

    throw error;
  }

  return {
    technician: data
  };
}


/* =========================================================
   UPDATE TECHNICIAN
   ========================================================= */

async function updateTechnician(
  db: any,
  input: any
) {

  if (
    !input?.id ||
    !/^[0-9a-f-]{36}$/i.test(
      input.id
    ) ||
    !/^[6-9]\d{9}$/.test(
      String(
        input.mobile || ""
      ).replace(
        /\D/g,
        ""
      )
    )
  ) {
    throw new Error(
      "Technician details are invalid."
    );
  }

  const {
    data: existing,
    error: existingError
  } =
    await db
      .from("technicians")
      .select(
        "auth_user_id"
      )
      .eq(
        "id",
        input.id
      )
      .single();

  if (
    existingError ||
    !existing
  ) {
    throw new Error(
      "Technician not found."
    );
  }

  const authUserId =
    existing.auth_user_id;

  const email =
    clean(
      input.email,
      254
    );

  const password =
    String(
      input.password || ""
    ).trim();

  if (!authUserId) {

    if (
      input.is_active === true
    ) {
      throw new Error(
        "This technician has no linked portal login account. Create or repair the login account before activating this technician."
      );
    }

  } else {

    if (email) {

      const {
        data: authUserData,
        error: authLookupError
      } =
        await db.auth.admin
          .getUserById(
            authUserId
          );

      if (
        authLookupError ||
        !authUserData?.user
      ) {
        throw new Error(
          "Technician portal login account could not be found."
        );
      }

      if (
        email !==
        authUserData.user.email
      ) {

        const {
          error: authUpdateError
        } =
          await db.auth.admin
            .updateUserById(
              authUserId,
              {
                email,
                email_confirm:
                  true
              }
            );

        if (authUpdateError) {
          throw new Error(
            authUpdateError.message
          );
        }
      }
    }

    if (password) {

      if (
        password.length < 6
      ) {
        throw new Error(
          "Technician password must contain at least 6 characters."
        );
      }

      const {
        error: passwordUpdateError
      } =
        await db.auth.admin
          .updateUserById(
            authUserId,
            {
              password
            }
          );

      if (
        passwordUpdateError
      ) {
        throw new Error(
          passwordUpdateError.message
        );
      }
    }
  }

  const {
    data,
    error
  } =
    await db
      .from("technicians")
      .update({
        auth_user_id:
          authUserId,

        full_name:
          clean(
            input.full_name,
            120
          ),

        mobile:
          String(
            input.mobile
          ).replace(
            /\D/g,
            ""
          ),

        username:
          clean(
            input.username,
            80
          ),

        specialization:
          Array.isArray(
            input.specialization
          )
            ? input.specialization.slice(
                0,
                10
              )
            : [],

        working_days:
          Array.isArray(
            input.working_days
          )
            ? input.working_days
            : [
                1,
                2,
                3,
                4,
                5,
                6
              ],

        working_start:
          input.working_start ||
          "10:00",

        working_end:
          input.working_end ||
          "19:00",

        is_active:
          input.is_active !== false
      })
      .eq(
        "id",
        input.id
      )
      .select()
      .single();

  if (error) {
    throw error;
  }

  return {
    technician: data
  };
}


/* =========================================================
   TOGGLE TECHNICIAN STATUS
   ========================================================= */

async function toggleTechnicianStatus(
  db: any,
  body: any
) {

  if (
    !body?.id ||
    !/^[0-9a-f-]{36}$/i.test(
      body.id
    )
  ) {
    throw new Error(
      "Invalid technician."
    );
  }

  const isActive =
    body.is_active === true;

  const {
    data: technician,
    error: technicianError
  } =
    await db
      .from("technicians")
      .select(
        "id,auth_user_id,is_active,full_name"
      )
      .eq(
        "id",
        body.id
      )
      .single();

  if (
    technicianError ||
    !technician
  ) {
    throw new Error(
      "Technician not found."
    );
  }

  if (
    isActive &&
    !technician.auth_user_id
  ) {
    throw new Error(
      "This technician has no linked portal login account. Create or repair the login account before activating this technician."
    );
  }

  const {
    data,
    error
  } =
    await db
      .from("technicians")
      .update({
        is_active:
          isActive
      })
      .eq(
        "id",
        body.id
      )
      .select()
      .single();

  if (error) {
    throw error;
  }

  return {
    technician: data
  };
}


/* =========================================================
   DELETE TECHNICIAN
   ========================================================= */

async function deleteTechnician(
  db: any,
  id: string
) {

  if (
    !id ||
    !/^[0-9a-f-]{36}$/i.test(
      id
    )
  ) {
    throw new Error(
      "Invalid technician."
    );
  }

  const {
    data: technician,
    error: technicianError
  } =
    await db
      .from("technicians")
      .select(
        "id,auth_user_id,is_active,full_name,technician_code"
      )
      .eq(
        "id",
        id
      )
      .single();

  if (
    technicianError ||
    !technician
  ) {
    throw new Error(
      "Technician not found."
    );
  }

  if (
    technician.is_active
  ) {
    throw new Error(
      "Active technician cannot be deleted. Deactivate the technician first."
    );
  }

  const {
    count: appointmentCount,
    error: appointmentError
  } =
    await db
      .from("appointments")
      .select(
        "id",
        {
          count: "exact",
          head: true
        }
      )
      .eq(
        "technician_id",
        id
      );

  if (appointmentError) {
    throw appointmentError;
  }

  if (
    (appointmentCount || 0) > 0
  ) {
    throw new Error(
      "This technician is assigned to one or more appointments. Reassign those appointments before deleting the technician."
    );
  }

  if (
    technician.auth_user_id
  ) {

    const {
      error: authDeleteError
    } =
      await db.auth.admin
        .deleteUser(
          technician.auth_user_id
        );

    if (authDeleteError) {
      throw new Error(
        "Technician portal login could not be deleted: " +
        authDeleteError.message
      );
    }
  }

  const {
    error: deleteError
  } =
    await db
      .from("technicians")
      .delete()
      .eq(
        "id",
        id
      );

  if (deleteError) {
    throw deleteError;
  }

  return {
    ok: true
  };
}


/* =========================================================
   NOTIFICATIONS
   ========================================================= */

async function notifications(
  db: any,
  userId: string
) {

  const {
    data,
    error
  } =
    await db
      .from("admin_notifications")
      .select(
        "*,appointments(appointment_id)"
      )
      .eq(
        "admin_id",
        userId
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      )
      .limit(50);

  if (error) {
    throw error;
  }

  return {
    notifications:
      data || []
  };
}


async function notificationLogs(
  db: any
) {

  const {
    data,
    error
  } =
    await db
      .from("notifications")
      .select(
        "id,channel,type,status,created_at,sent_at,error,appointments(appointment_id)"
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      )
      .limit(100);

  if (error) {
    throw error;
  }

  return {
    logs:
      data || []
  };
}


async function markRead(
  db: any,
  userId: string,
  id: string
) {

  const {
    error
  } =
    await db
      .from("admin_notifications")
      .update({
        is_read: true,
        read_at:
          new Date().toISOString()
      })
      .eq(
        "id",
        id
      )
      .eq(
        "admin_id",
        userId
      );

  if (error) {
    throw error;
  }

  return {
    ok: true
  };
}


/* =========================================================
   ADMIN SUPPORT
   SUPPORT REQUEST LIST
   ========================================================= */

async function supportRequests(
  db: any,
  body: any
) {

  const filters =
    body?.filters || {};

  let query =
    db
      .from("support_requests")
      .select(
        `
        id,
        support_token,
        appointment_id,
        technician_id,
        support_type,
        problem_details,
        latitude,
        longitude,
        location_url,
        location_captured_at,
        status,
        created_at,
        updated_at,
        acknowledged_at,
        resolved_at,
        closed_at,

        technicians(
          id,
          technician_code,
          full_name,
          mobile,
          username
        ),

        appointments(
          id,
          appointment_id,
          appointment_code,
          appointment_date,
          appointment_time,
          customer_name,
          mobile,
          service_category,
          service_type,
          service_address,
          job_code,
          status
        )
        `,
        {
          count: "exact"
        }
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      );

  if (
    filters.status
  ) {

    const status =
      String(
        filters.status
      )
        .trim()
        .toUpperCase();

    const allowedStatuses = [
      "OPEN",
      "ACKNOWLEDGED",
      "IN_PROGRESS",
      "RESOLVED",
      "CLOSED",
      "CANCELLED"
    ];

    if (
      !allowedStatuses.includes(
        status
      )
    ) {
      throw new Error(
        "Invalid support status."
      );
    }

    query =
      query.eq(
        "status",
        status
      );
  }

  if (
    filters.technician_id
  ) {

    if (
      !isUuid(
        filters.technician_id
      )
    ) {
      throw new Error(
        "Invalid technician."
      );
    }

    query =
      query.eq(
        "technician_id",
        filters.technician_id
      );
  }

  if (
    filters.support_type
  ) {

    query =
      query.eq(
        "support_type",
        String(
          filters.support_type
        ).trim()
      );
  }

  if (
    filters.support_token
  ) {

    const token =
      String(
        filters.support_token
      )
        .trim()
        .toUpperCase();

    query =
      query.eq(
        "support_token",
        token
      );
  }

  const offset =
    Math.max(
      0,
      Number(
        body?.offset
      ) || 0
    );

  const limit =
    Math.min(
      50,
      Math.max(
        1,
        Number(
          body?.limit
        ) || 50
      )
    );

  const {
    data,
    error,
    count
  } =
    await query.range(
      offset,
      offset + limit - 1
    );

  if (error) {
    throw new Error(
      "SUPPORT_REQUESTS_QUERY_FAILED"
    );
  }

  return {
    requests:
      data || [],

    count:
      count || 0,

    offset,
    limit
  };
}


/* =========================================================
   ADMIN SUPPORT
   SUPPORT REQUEST DETAIL
   ========================================================= */

async function supportGetRequest(
  db: any,
  body: any
) {

  const requestId =
    String(
      body?.request_id ||
      ""
    ).trim();

  if (
    !requestId ||
    !isUuid(requestId)
  ) {
    throw new Error(
      "Invalid support request."
    );
  }

  const {
    data,
    error
  } =
    await db
      .from("support_requests")
      .select(
        `
        id,
        support_token,
        appointment_id,
        technician_id,
        support_type,
        problem_details,
        latitude,
        longitude,
        location_url,
        location_captured_at,
        status,
        created_at,
        updated_at,
        acknowledged_at,
        resolved_at,
        closed_at,

        technicians(
          id,
          technician_code,
          full_name,
          mobile,
          username,
          specialization,
          working_days,
          working_start,
          working_end,
          is_active,
          auth_user_id,
          profile_image_path
        ),

        appointments(
          id,
          appointment_id,
          appointment_code,
          appointment_date,
          appointment_time,
          customer_name,
          mobile,
          email,
          service_category,
          service_type,
          service_location_type,
          service_address,
          landmark,
          latitude,
          longitude,
          google_maps_url,
          problem_description,
          job_code,
          status
        )
        `
      )
      .eq(
        "id",
        requestId
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      "SUPPORT_REQUEST_DETAIL_FAILED"
    );
  }

  if (!data) {
    throw new Error(
      "SUPPORT_REQUEST_NOT_FOUND"
    );
  }

  return {
    request: data
  };
}


/* =========================================================
   ADMIN SUPPORT
   SUPPORT MESSAGES
   ========================================================= */

async function supportMessages(
  db: any,
  body: any
) {

  const requestId =
    String(
      body?.support_request_id ||
      ""
    ).trim();

  if (
    !requestId ||
    !isUuid(requestId)
  ) {
    throw new Error(
      "Invalid support request."
    );
  }

  const {
    data: supportRequest,
    error: supportRequestError
  } =
    await db
      .from("support_requests")
      .select(
        `
        id,
        support_token,
        status,
        technician_id
        `
      )
      .eq(
        "id",
        requestId
      )
      .maybeSingle();

  if (supportRequestError) {
    throw new Error(
      "SUPPORT_REQUEST_VERIFY_FAILED"
    );
  }

  if (!supportRequest) {
    throw new Error(
      "SUPPORT_REQUEST_NOT_FOUND"
    );
  }

  const {
    data,
    error
  } =
    await db
      .from("support_messages")
      .select(
        `
        id,
        support_request_id,
        sender_type,
        sender_user_id,
        message,
        created_at
        `
      )
      .eq(
        "support_request_id",
        requestId
      )
      .order(
        "created_at",
        {
          ascending: true
        }
      );

  if (error) {
    throw new Error(
      "SUPPORT_MESSAGES_QUERY_FAILED"
    );
  }

  return {
    support_request: {
      id:
        supportRequest.id,

      support_token:
        supportRequest.support_token,

      status:
        supportRequest.status,

      technician_id:
        supportRequest.technician_id
    },

    messages:
      data || []
  };
}


/* =========================================================
   ADMIN SUPPORT
   SEND MESSAGE
   ========================================================= */

async function sendSupportMessage(
  db: any,
  adminUserId: string,
  body: any
) {

  if (
    !isUuid(
      adminUserId
    )
  ) {
    throw new Error(
      "Invalid administrator."
    );
  }

  const requestId =
    String(
      body?.support_request_id ||
      ""
    ).trim();

  const message =
    String(
      body?.message ||
      ""
    ).trim();

  if (
    !requestId ||
    !isUuid(requestId)
  ) {
    throw new Error(
      "Invalid support request."
    );
  }

  if (!message) {
    throw new Error(
      "Message is required."
    );
  }

  if (
    message.length > 2000
  ) {
    throw new Error(
      "Message cannot exceed 2000 characters."
    );
  }

  const {
    data: admin,
    error: adminError
  } =
    await db
      .from("admin_users")
      .select(
        "user_id"
      )
      .eq(
        "user_id",
        adminUserId
      )
      .maybeSingle();

  if (adminError) {
    throw new Error(
      "ADMIN_LOOKUP_FAILED"
    );
  }

  if (!admin) {
    throw new Error(
      "ADMIN_REQUIRED"
    );
  }

  const {
    data: supportRequest,
    error: supportRequestError
  } =
    await db
      .from("support_requests")
      .select(
        `
        id,
        support_token,
        technician_id,
        status
        `
      )
      .eq(
        "id",
        requestId
      )
      .maybeSingle();

  if (supportRequestError) {
    throw new Error(
      "SUPPORT_REQUEST_VERIFY_FAILED"
    );
  }

  if (!supportRequest) {
    throw new Error(
      "SUPPORT_REQUEST_NOT_FOUND"
    );
  }

  const currentStatus =
    String(
      supportRequest.status ||
      ""
    ).toUpperCase();

  if (
    currentStatus === "CLOSED" ||
    currentStatus === "CANCELLED"
  ) {
    throw new Error(
      "SUPPORT_REQUEST_CLOSED"
    );
  }

  const {
    data,
    error
  } =
    await db
      .from("support_messages")
      .insert({
        support_request_id:
          requestId,

        sender_type:
          "ADMIN",

        sender_user_id:
          adminUserId,

        message
      })
      .select(
        `
        id,
        support_request_id,
        sender_type,
        sender_user_id,
        message,
        created_at
        `
      )
      .single();

  if (error) {
    throw new Error(
      "SUPPORT_MESSAGE_SEND_FAILED"
    );
  }

  return {
    message: data
  };
}

/* =========================================================
   ADMIN DIRECT SUPPORT
   CONVERSATION LIST
   ========================================================= */

async function directSupportConversations(
  db: any
) {

  const {
    data: technicians,
    error: technicianError
  } = await db
    .from("technicians")
    .select(`
      id,
      technician_code,
      full_name,
      mobile,
      username,
      is_active
    `)
    .order(
      "full_name",
      {
        ascending: true
      }
    );


  if (
    technicianError
  ) {

    console.error(
      "DIRECT SUPPORT TECHNICIANS QUERY ERROR:",
      technicianError.message
    );

    throw new Error(
      "DIRECT_SUPPORT_CONVERSATIONS_QUERY_FAILED"
    );

  }


  const technicianIds =
    (technicians || [])
      .map(
        (technician: any) =>
          technician.id
      )
      .filter(
        (id: any) =>
          isUuid(id)
      );


  if (
    technicianIds.length === 0
  ) {

    return {
      conversations: []
    };

  }


  const {
    data: messages,
    error: messageError
  } = await db
    .from(
      "technician_direct_messages"
    )
    .select(`
      id,
      technician_id,
      sender_type,
      sender_user_id,
      message,
      read_at_admin,
      created_at
    `)
    .in(
      "technician_id",
      technicianIds
    )
    .order(
      "created_at",
      {
        ascending: false
      }
    );


  if (
    messageError
  ) {

    console.error(
      "DIRECT SUPPORT CONVERSATION QUERY ERROR:",
      messageError.message
    );

    throw new Error(
      "DIRECT_SUPPORT_CONVERSATIONS_QUERY_FAILED"
    );

  }


  const latestMessages =
    new Map<string, any>();

  const unreadCounts =
    new Map<string, number>();


  for (
    const message of
      messages || []
  ) {

    const technicianId =
      message.technician_id;


    if (
      !latestMessages.has(
        technicianId
      )
    ) {

      latestMessages.set(
        technicianId,
        message
      );

    }


    if (
      message.sender_type ===
        "TECHNICIAN" &&
      !message.read_at_admin
    ) {

      unreadCounts.set(
        technicianId,

        (
          unreadCounts.get(
            technicianId
          ) || 0
        ) + 1

      );

    }

  }


  const conversations =
    (technicians || [])
      .filter(
        (technician: any) =>
          latestMessages.has(
            technician.id
          )
      )
      .map(
        (technician: any) => {

          const latest =
            latestMessages.get(
              technician.id
            );


          return {

            technician_id:
              technician.id,

            technician_code:
              technician.technician_code,

            full_name:
              technician.full_name,

            mobile:
              technician.mobile,

            username:
              technician.username,

            is_active:
              technician.is_active,

            unread_count:
              unreadCounts.get(
                technician.id
              ) || 0,

            last_message:
              latest?.message ||
              null,

            last_message_sender:
              latest?.sender_type ||
              null,

            last_message_at:
              latest?.created_at ||
              null

          };

        }
      )
      .sort(
        (
          a: any,
          b: any
        ) =>
          new Date(
            b.last_message_at
          ).getTime() -
          new Date(
            a.last_message_at
          ).getTime()
      );


  return {
    conversations
  };

}

/* =========================================================
   DIRECT SUPPORT MESSAGES
   ADMIN LOAD + MARK TECHNICIAN MESSAGES AS SEEN
   ========================================================= */

async function directSupportMessages(
    db,
    body
) {

    const technicianId =
        String(
            body?.technician_id || ""
        ).trim();


    if (!technicianId) {

        throw new Error(
            "TECHNICIAN_ID_REQUIRED"
        );

    }


    /*
     * Verify technician
     */

    const {
        data: technician,
        error: technicianError
    } = await db
        .from("technicians")
        .select(`
            id,
            technician_code,
            full_name,
            mobile,
            username,
            is_active
        `)
        .eq(
            "id",
            technicianId
        )
        .maybeSingle();


    if (technicianError) {

        throw new Error(
            "TECHNICIAN_QUERY_FAILED"
        );

    }


    if (!technician) {

        throw new Error(
            "TECHNICIAN_NOT_FOUND"
        );

    }


    /*
     * -----------------------------------------------------
     * MARK TECHNICIAN MESSAGES AS SEEN
     * -----------------------------------------------------
     */

    const seenAt =
        new Date().toISOString();


    const {
        error: readError
    } = await db
        .from("technician_direct_messages")
        .update({
            read_at_admin: seenAt
        })
        .eq(
            "technician_id",
            technicianId
        )
        .eq(
            "sender_type",
            "TECHNICIAN"
        )
        .is(
            "read_at_admin",
            null
        );


    if (readError) {

        throw new Error(
            "DIRECT_SUPPORT_READ_UPDATE_FAILED"
        );

    }


    /*
     * -----------------------------------------------------
     * LOAD MESSAGES
     * -----------------------------------------------------
     */

    const {
        data: messages,
        error: messageError
    } = await db
        .from("technician_direct_messages")
        .select(`
            id,
            technician_id,
            sender_type,
            sender_user_id,
            message,
            read_at_technician,
            read_at_admin,
            created_at
        `)
        .eq(
            "technician_id",
            technicianId
        )
        .order(
            "created_at",
            {
                ascending: true
            }
        );


    if (messageError) {

        throw new Error(
            "DIRECT_SUPPORT_MESSAGES_FAILED"
        );

    }


    return {
        technician,
        messages:
            Array.isArray(messages)
                ? messages
                : []
    };

}

/* =========================================================
   DIRECT CHAT MESSAGE HTML
   TIME + SEEN STATUS
   ========================================================= */

function renderAdminDirectSupportMessages(
    messages
) {

    if (!messages.length) {

        return `
            <div
                class="admin-floating-support-no-messages"
            >
                No messages yet.
            </div>
        `;

    }


    return messages
        .map(message => {

            const sender =
                String(
                    message.sender_type || ""
                ).toUpperCase();


            const isAdmin =
                sender === "ADMIN";


            const isSeen =
                isAdmin
                    ? Boolean(
                        message.read_at_technician
                    )
                    : Boolean(
                        message.read_at_admin
                    );


            const time =
                adminSupportFormatDate(
                    message.created_at
                );


            return `

                <div
                    class="
                        admin-floating-support-message
                        ${isAdmin
                            ? "admin"
                            : "technician"}
                    "
                    data-direct-message-id="${e(
                        message.id
                    )}"
                >

                    <div
                        class="
                            admin-floating-support-message-text
                        "
                    >
                        ${e(
                            message.message || ""
                        ).replaceAll(
                            "\n",
                            "<br>"
                        )}
                    </div>


                    <div
                        class="
                            admin-floating-support-message-meta
                            direct-message-meta
                        "
                    >

                        <small>
                            ${e(time)}
                        </small>


                        ${
                            isAdmin
                                ? `
                                    <span
                                        class="
                                            direct-message-seen
                                            ${
                                                isSeen
                                                    ? "is-seen"
                                                    : ""
                                            }
                                        "
                                        aria-label="${
                                            isSeen
                                                ? "Seen"
                                                : "Sent"
                                        }"
                                    >
                                        ✓✓
                                    </span>
                                `
                                : ""
                        }

                    </div>

                </div>

            `;

        })
        .join("");

}


/* =========================================================
   ADMIN DIRECT SUPPORT
   SEND MESSAGE
   ========================================================= */

async function sendDirectSupportMessage(
  db: any,
  adminUserId: string,
  body: any
) {

  if (
    !isUuid(adminUserId)
  ) {

    throw new Error(
      "Invalid administrator."
    );

  }


  const technicianId =
    String(
      body?.technician_id ||
      ""
    ).trim();


  const message =
    String(
      body?.message ||
      ""
    ).trim();


  if (
    !technicianId ||
    !isUuid(technicianId)
  ) {

    throw new Error(
      "Invalid technician."
    );

  }


  if (!message) {

    throw new Error(
      "Message is required."
    );

  }


  if (
    message.length > 2000
  ) {

    throw new Error(
      "Message cannot exceed 2000 characters."
    );

  }


  /*
   * Verify admin.
   */

  const {
    data: admin,
    error: adminError
  } =
    await db
      .from("admin_users")
      .select(
        "user_id"
      )
      .eq(
        "user_id",
        adminUserId
      )
      .maybeSingle();


  if (
    adminError
  ) {

    throw new Error(
      "ADMIN_LOOKUP_FAILED"
    );

  }


  if (!admin) {

    throw new Error(
      "ADMIN_REQUIRED"
    );

  }


  /*
   * Verify technician.
   */

  const {
    data: technician,
    error: technicianError
  } = await db
    .from("technicians")
    .select(`
      id,
      auth_user_id,
      is_active
    `)
    .eq(
      "id",
      technicianId
    )
    .maybeSingle();


  if (
    technicianError
  ) {

    throw new Error(
      "TECHNICIAN_LOOKUP_FAILED"
    );

  }


  if (!technician) {

    throw new Error(
      "TECHNICIAN_NOT_FOUND"
    );

  }


  /*
   * Admin can reply even if technician
   * has no support request.
   *
   * Direct chat has no request status.
   */


  const {
    data,
    error
  } = await db
    .from(
      "technician_direct_messages"
    )
    id="3k4p6z"
.insert({

  technician_id:
    technicianId,

  sender_type:
    "ADMIN",

  sender_user_id:
    adminUserId,

  message:
    message,

  /*
   * Technician has not seen
   * this message yet.
   */
  read_at_technician:
    null,

  /*
   * Admin obviously has not
   * received a "seen" event
   * from itself.
   */
  read_at_admin:
    null

})
.select(`
  id,
  technician_id,
  sender_type,
  sender_user_id,
  message,
  read_at_technician,
  read_at_admin,
  created_at
`)
.single();


  if (
    error
  ) {

    console.error(
      "ADMIN DIRECT SUPPORT MESSAGE INSERT ERROR:",
      {
        message:
          error.message,

        details:
          error.details,

        hint:
          error.hint,

        code:
          error.code
      }
    );

    throw new Error(
      "DIRECT_SUPPORT_MESSAGE_SEND_FAILED"
    );

  }


  return {

    message:
      data

  };

}



/* =========================================================
   ADMIN SUPPORT
   STATUS UPDATE
   ========================================================= */

async function updateSupportStatus(
  db: any,
  adminUserId: string,
  body: any
) {

  if (
    !isUuid(
      adminUserId
    )
  ) {
    throw new Error(
      "Invalid administrator."
    );
  }

  const requestId =
    String(
      body?.support_request_id ||
      ""
    ).trim();

  const newStatus =
    String(
      body?.status ||
      ""
    )
      .trim()
      .toUpperCase();

  const note =
    clean(
      body?.note,
      1000
    );

  if (
    !requestId ||
    !isUuid(requestId)
  ) {
    throw new Error(
      "Invalid support request."
    );
  }

  const allowedStatuses = [
    "OPEN",
    "ACKNOWLEDGED",
    "IN_PROGRESS",
    "RESOLVED",
    "CLOSED",
    "CANCELLED"
  ];

  if (
    !allowedStatuses.includes(
      newStatus
    )
  ) {
    throw new Error(
      "Invalid support status."
    );
  }

  const {
    data: admin,
    error: adminError
  } =
    await db
      .from("admin_users")
      .select(
        "user_id"
      )
      .eq(
        "user_id",
        adminUserId
      )
      .maybeSingle();

  if (adminError) {
    throw new Error(
      "ADMIN_LOOKUP_FAILED"
    );
  }

  if (!admin) {
    throw new Error(
      "ADMIN_REQUIRED"
    );
  }

  const {
    data: supportRequest,
    error: supportRequestError
  } =
    await db
      .from("support_requests")
      .select(
        `
        id,
        support_token,
        technician_id,
        status,
        acknowledged_at,
        resolved_at,
        closed_at
        `
      )
      .eq(
        "id",
        requestId
      )
      .maybeSingle();

  if (supportRequestError) {
    throw new Error(
      "SUPPORT_REQUEST_VERIFY_FAILED"
    );
  }

  if (!supportRequest) {
    throw new Error(
      "SUPPORT_REQUEST_NOT_FOUND"
    );
  }

  const currentStatus =
    String(
      supportRequest.status ||
      ""
    ).toUpperCase();

  if (
    currentStatus === newStatus
  ) {
    return {
      request:
        supportRequest
    };
  }

  if (
    currentStatus === "CLOSED" ||
    currentStatus === "CANCELLED"
  ) {
    throw new Error(
      "SUPPORT_STATUS_TERMINAL"
    );
  }

  const transitions: any = {

    OPEN: [
      "ACKNOWLEDGED",
      "CANCELLED"
    ],

    ACKNOWLEDGED: [
      "IN_PROGRESS",
      "CANCELLED"
    ],

    IN_PROGRESS: [
      "RESOLVED",
      "CANCELLED"
    ],

    RESOLVED: [
      "CLOSED"
    ]

  };

  const allowedNext =
    transitions[
      currentStatus
    ] || [];

  if (
    !allowedNext.includes(
      newStatus
    )
  ) {
    throw new Error(
      `Invalid support status transition: ${currentStatus} → ${newStatus}`
    );
  }

  const now =
    new Date().toISOString();

  const update: any = {

    status:
      newStatus,

    updated_at:
      now

  };

  if (
    newStatus ===
    "ACKNOWLEDGED"
  ) {
    update.acknowledged_at =
      now;
  }

  if (
    newStatus ===
    "RESOLVED"
  ) {
    update.resolved_at =
      now;
  }

  if (
    newStatus ===
    "CLOSED"
  ) {
    update.closed_at =
      now;
  }

  const {
    data,
    error
  } =
    await db
      .from("support_requests")
      .update(update)
      .eq(
        "id",
        requestId
      )
      .select(
        `
        id,
        support_token,
        appointment_id,
        technician_id,
        support_type,
        problem_details,
        latitude,
        longitude,
        location_url,
        location_captured_at,
        status,
        created_at,
        updated_at,
        acknowledged_at,
        resolved_at,
        closed_at
        `
      )
      .single();

  if (error) {
    throw new Error(
      "SUPPORT_STATUS_UPDATE_FAILED"
    );
  }

  if (note) {

    const {
      error: noteError
    } =
      await db
        .from("support_messages")
        .insert({
          support_request_id:
            requestId,

          sender_type:
            "ADMIN",

          sender_user_id:
            adminUserId,

          message:
            `Status updated to ${newStatus}.\n${note}`
        });

    /*
     * Status update is already successful.
     * A note failure must not roll back it.
     */
    if (noteError) {
      console.error(
        "Support status note insert failed:",
        noteError.message
      );
    }
  }

  return {
    request: data
  };
}


/* =========================================================
   DELETE APPOINTMENT
   ========================================================= */

async function deleteAppointment(
  db: any,
  id: string
) {

  if (
    !/^[0-9a-f-]{36}$/i.test(
      id || ""
    )
  ) {
    throw new Error(
      "Invalid appointment."
    );
  }

  const {
    error
  } =
    await db
      .from("appointments")
      .delete()
      .eq(
        "id",
        id
      );

  if (error) {
    throw error;
  }

  return {
    ok: true
  };
}


/* =========================================================
   HELPERS
   ========================================================= */

function isUuid(
  value: any
) {

  return /^[0-9a-f-]{36}$/i.test(
    String(
      value || ""
    )
  );
}


function clean(
  value: any,
  max: number
) {

  return typeof value ===
    "string"
    ? value
        .trim()
        .slice(0, max)
    : null;
}