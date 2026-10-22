function characterFixture() {
    const slot = male => ({url:"", local_image_id:"", source:"", seed:null, prompt:"", negative_prompt:"", note:"", male});
    const outfit = {id:"work-clothes",name:"Work clothes",clothing:{shirt:"Long-sleeved linen shirt",pants:"Full-length trousers",feet:"Leather boots"}};
    return {
        lite:true, version:1, id:"lite-definition-fixture", name:"Fixture Archivist", fallback_name:"Fixture Archive Clerk",
        source:"Original", creation_tool:"Definition contract fixture", genres:["fantasy"],
        can_die:false, romanceable:true, gender:"female", age:30, role:"Archivist",
        personality_description:"Patient and observant.", speech_style:"Plain and direct.", boldness:5,
        starting_relationship_to_player:"New acquaintance",starting_trust:0,starting_attraction:0,starting_affection:0,
        starting_state_of_mind:"Alert",starting_physical_state:"Healthy",starting_pose:"Standing behind the archive desk",
        appearance:{species:"Human",height:10,shoulder_width:10,chest:10,upper_body_build:10,midsection_build:10,hip_width:10,butt_build:10,lower_body_build:10,arm_length:10,leg_length:10,skin_color:"Brown",eye_color:"Brown",hair_color:"Black",hair_length:"Short",hair_type:"Curly",extra_description:"",extra_description_lower_body:"",nonhuman_lower_body:false},
        outfits:[outfit],fallback_outfits:[structuredClone(outfit)],starting_outfit_id:"work-clothes",fallback_starting_outfit_id:"work-clothes",
        starting_held_items:{left_hand:null,right_hand:null},starting_inventory:[],starting_known_facts:[],stats:{},
        default_seed:1,image_prompt_config:{seed_enabled:true,seed:1,style:"",profile_style:"",negative:"",negative_prompt:""},default_profile_image:slot(false),
        profile_image_presentations:{male:slot(true),non_male:slot(false)},
        profile_images:{active_image_id:"",image_ids:[]},images:{active_image_id:"",image_ids:[]},voice:null,
        created_at:"2026-10-22T00:00:00.000Z",updated_at:"2026-10-22T00:00:00.000Z",
    };
}

module.exports = {characterFixture};